"""수수료 계산 기록 API"""
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()
KST = timezone(timedelta(hours=9))


def _check_admin(request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    if request.headers.get("X-Admin-Password", "") != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀렸습니다.")


class FeeRecordCreate(BaseModel):
    calc_type: str
    input_json: str
    result_json: str
    note: Optional[str] = None


@router.get("/fee/records")
def list_fee_records(
    calc_type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
):
    try:
        conn = get_connection()
    except Exception:
        return {"items": [], "total": 0}
    try:
        conditions = []
        params: list = []
        if calc_type:
            conditions.append("calc_type = ?")
            params.append(calc_type)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        total = conn.execute(f"SELECT COUNT(*) FROM fee_records {where}", params).fetchone()[0]
        offset = (page - 1) * per_page
        rows = conn.execute(
            f"SELECT * FROM fee_records {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        return {"items": [dict(r) for r in rows], "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        return {"items": [], "total": 0, "error": str(e)}
    finally:
        conn.close()


@router.post("/fee/records")
def create_fee_record(body: FeeRecordCreate):
    if not body.calc_type.strip():
        raise HTTPException(status_code=400, detail="계산 유형을 입력하세요.")
    try:
        conn = get_connection()
        cur = conn.execute(
            "INSERT INTO fee_records (calc_type, input_json, result_json, note, created_at) VALUES (?, ?, ?, ?, ?)",
            [body.calc_type.strip(), body.input_json, body.result_json, body.note,
             datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")],
        )
        conn.commit()
        row = conn.execute("SELECT * FROM fee_records WHERE id = ?", [cur.lastrowid]).fetchone()
        result = dict(row)
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/fee/records/{record_id}")
def delete_fee_record(record_id: int, request: Request):
    _check_admin(request)
    try:
        conn = get_connection()
        conn.execute("DELETE FROM fee_records WHERE id = ?", [record_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
