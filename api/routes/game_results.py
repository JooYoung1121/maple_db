"""게임 결과 저장 API"""
import json
import os
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()


class GameResultCreate(BaseModel):
    game_type: str  # 'roulette' | 'dice' | 'plinko'
    participants: list[str]
    winner: str
    result: Optional[dict] = None


@router.get("/game-results")
def list_game_results(
    game_type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
):
    try:
        conn = get_connection()
    except Exception:
        return {"results": [], "total": 0}

    try:
        where = "WHERE game_type = ?" if game_type else ""
        count_params = [game_type] if game_type else []
        total = conn.execute(
            f"SELECT COUNT(*) FROM game_results {where}", count_params
        ).fetchone()[0]
        offset = (page - 1) * per_page
        list_params = count_params + [per_page, offset]
        rows = conn.execute(
            f"SELECT * FROM game_results {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            list_params,
        ).fetchall()
        results = []
        for r in rows:
            item = dict(r)
            item["participants"] = json.loads(item.pop("participants_json"))
            raw_result = item.pop("result_json", None)
            item["result"] = json.loads(raw_result) if raw_result else None
            results.append(item)
        return {"results": results, "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        return {"results": [], "total": 0, "error": str(e)}
    finally:
        conn.close()


@router.post("/game-results")
def create_game_result(body: GameResultCreate):
    if body.game_type not in ("roulette", "dice", "plinko", "ladder"):
        raise HTTPException(status_code=400, detail="game_type이 올바르지 않습니다.")
    if not body.winner.strip():
        raise HTTPException(status_code=400, detail="당첨자 이름을 입력하세요.")
    if len(body.participants) < 2:
        raise HTTPException(status_code=400, detail="참가자가 2명 이상 필요합니다.")

    try:
        conn = get_connection()
        cur = conn.execute(
            "INSERT INTO game_results (game_type, participants_json, winner, result_json) VALUES (?, ?, ?, ?)",
            [
                body.game_type,
                json.dumps(body.participants, ensure_ascii=False),
                body.winner.strip(),
                json.dumps(body.result, ensure_ascii=False) if body.result is not None else None,
            ],
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {"id": new_id, "game_type": body.game_type, "winner": body.winner, "participants": body.participants}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/game-results/{result_id}")
def delete_game_result(result_id: int, request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    provided_pw = request.headers.get("X-Admin-Password", "")
    if provided_pw != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀렸습니다.")

    try:
        conn = get_connection()
        conn.execute("DELETE FROM game_results WHERE id = ?", [result_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
