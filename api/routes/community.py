"""커뮤니티 기능 API — 투표(poll) + 사용자 선택지 추가/복수투표/마감일"""
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()

KST = timezone(timedelta(hours=9))


class PollCreate(BaseModel):
    question: str
    options: list[str]
    allow_user_options: bool = False
    allow_multiple: bool = False
    deadline: Optional[str] = None  # ISO datetime string


class PollVote(BaseModel):
    option_index: int


class PollAddOption(BaseModel):
    option: str


def _now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")


def _is_expired(deadline: Optional[str]) -> bool:
    if not deadline:
        return False
    try:
        dl = datetime.fromisoformat(deadline)
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=KST)
        return datetime.now(KST) > dl
    except Exception:
        return False


@router.get("/polls")
def list_polls(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
):
    try:
        conn = get_connection()
    except Exception:
        return {"polls": [], "total": 0}

    try:
        total = conn.execute("SELECT COUNT(*) FROM community_polls").fetchone()[0]
        offset = (page - 1) * per_page
        rows = conn.execute(
            "SELECT * FROM community_polls ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [per_page, offset],
        ).fetchall()
        polls = []
        for r in rows:
            p = dict(r)
            p["options"] = json.loads(p["options_json"])
            p["vote_counts"] = json.loads(p["vote_counts_json"])
            del p["options_json"]
            del p["vote_counts_json"]
            p["allow_user_options"] = bool(p.get("allow_user_options", 0))
            p["allow_multiple"] = bool(p.get("allow_multiple", 0))
            p["deadline"] = p.get("deadline") or None
            p["expired"] = _is_expired(p["deadline"])
            polls.append(p)
        return {"polls": polls, "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        return {"polls": [], "total": 0, "error": str(e)}
    finally:
        conn.close()


@router.post("/polls")
def create_poll(body: PollCreate):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="질문을 입력하세요.")
    if len(body.options) < 2:
        raise HTTPException(status_code=400, detail="선택지를 2개 이상 입력하세요.")
    options = [o.strip() for o in body.options if o.strip()]
    if len(options) < 2:
        raise HTTPException(status_code=400, detail="유효한 선택지가 2개 이상 필요합니다.")

    vote_counts = [0] * len(options)
    try:
        conn = get_connection()
        cur = conn.execute(
            """INSERT INTO community_polls
               (question, options_json, vote_counts_json, allow_user_options, allow_multiple, deadline)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [
                body.question.strip(),
                json.dumps(options, ensure_ascii=False),
                json.dumps(vote_counts),
                1 if body.allow_user_options else 0,
                1 if body.allow_multiple else 0,
                body.deadline or None,
            ],
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {
            "id": new_id,
            "question": body.question,
            "options": options,
            "vote_counts": vote_counts,
            "allow_user_options": body.allow_user_options,
            "allow_multiple": body.allow_multiple,
            "deadline": body.deadline,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/polls/{poll_id}/vote")
def vote_poll(poll_id: int, body: PollVote, request: Request):
    voter_ip = request.client.host if request.client else "unknown"

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=500, detail="DB 연결 실패")

    try:
        row = conn.execute("SELECT * FROM community_polls WHERE id = ?", [poll_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="투표를 찾을 수 없습니다.")

        # 마감일 체크
        deadline = row["deadline"] if "deadline" in row.keys() else None
        if _is_expired(deadline):
            raise HTTPException(status_code=400, detail="마감된 투표입니다.")

        options = json.loads(row["options_json"])
        if body.option_index < 0 or body.option_index >= len(options):
            raise HTTPException(status_code=400, detail="유효하지 않은 선택지입니다.")

        allow_multiple = bool(row["allow_multiple"]) if "allow_multiple" in row.keys() else False

        if allow_multiple:
            # 복수투표: (poll_id, voter_ip, option_index) 별 중복 확인
            existing = conn.execute(
                "SELECT id FROM community_poll_votes WHERE poll_id = ? AND voter_ip = ? AND option_index = ?",
                [poll_id, voter_ip, body.option_index],
            ).fetchone()
            if existing:
                raise HTTPException(status_code=409, detail="이 선택지에 이미 투표하셨습니다.")
        else:
            # 단일투표: (poll_id, voter_ip) 중복 확인
            existing = conn.execute(
                "SELECT id FROM community_poll_votes WHERE poll_id = ? AND voter_ip = ?",
                [poll_id, voter_ip],
            ).fetchone()
            if existing:
                raise HTTPException(status_code=409, detail="이미 투표하셨습니다.")

        # 투표 기록
        conn.execute(
            "INSERT INTO community_poll_votes (poll_id, option_index, voter_ip) VALUES (?, ?, ?)",
            [poll_id, body.option_index, voter_ip],
        )

        # vote_counts 업데이트
        vote_counts = json.loads(row["vote_counts_json"])
        vote_counts[body.option_index] += 1
        conn.execute(
            "UPDATE community_polls SET vote_counts_json = ? WHERE id = ?",
            [json.dumps(vote_counts), poll_id],
        )
        conn.commit()

        return {"poll_id": poll_id, "option_index": body.option_index, "vote_counts": vote_counts}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/polls/{poll_id}/options")
def add_poll_option(poll_id: int, body: PollAddOption):
    if not body.option.strip():
        raise HTTPException(status_code=400, detail="선택지를 입력하세요.")

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=500, detail="DB 연결 실패")

    try:
        row = conn.execute("SELECT * FROM community_polls WHERE id = ?", [poll_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="투표를 찾을 수 없습니다.")

        if not bool(row["allow_user_options"]) if "allow_user_options" in row.keys() else False:
            raise HTTPException(status_code=403, detail="이 투표에는 선택지를 추가할 수 없습니다.")

        if _is_expired(row["deadline"] if "deadline" in row.keys() else None):
            raise HTTPException(status_code=400, detail="마감된 투표입니다.")

        options = json.loads(row["options_json"])
        vote_counts = json.loads(row["vote_counts_json"])

        new_option = body.option.strip()
        if new_option in options:
            raise HTTPException(status_code=409, detail="이미 존재하는 선택지입니다.")
        if len(options) >= 20:
            raise HTTPException(status_code=400, detail="선택지는 최대 20개까지 가능합니다.")

        options.append(new_option)
        vote_counts.append(0)

        conn.execute(
            "UPDATE community_polls SET options_json = ?, vote_counts_json = ? WHERE id = ?",
            [json.dumps(options, ensure_ascii=False), json.dumps(vote_counts), poll_id],
        )
        conn.commit()
        conn.close()
        return {"poll_id": poll_id, "options": options, "vote_counts": vote_counts}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            conn.close()
        except Exception:
            pass


@router.delete("/polls/{poll_id}")
def delete_poll(poll_id: int):
    try:
        conn = get_connection()
        conn.execute("DELETE FROM community_poll_votes WHERE poll_id = ?", [poll_id])
        conn.execute("DELETE FROM community_polls WHERE id = ?", [poll_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
