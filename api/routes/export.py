"""Excel export route"""
import io
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse

import openpyxl

from crawler.db import get_connection

router = APIRouter()

EXPORT_QUERIES = {
    "items": "SELECT * FROM items ORDER BY id",
    "mobs": "SELECT * FROM mobs ORDER BY level, id",
    "maps": "SELECT * FROM maps ORDER BY id",
    "npcs": "SELECT * FROM npcs ORDER BY id",
    "quests": "SELECT * FROM quests ORDER BY level_req, id",
    "blog": "SELECT * FROM blog_posts ORDER BY id",
}

VALID_TYPES = set(EXPORT_QUERIES.keys())


@router.get("/export")
def export_data(
    type: str = Query(default="items"),
    format: str = Query(default="xlsx"),
):
    if type not in VALID_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type. Choose from: {', '.join(sorted(VALID_TYPES))}",
        )
    if format != "xlsx":
        raise HTTPException(status_code=400, detail="Only xlsx format is supported")

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        rows = conn.execute(EXPORT_QUERIES[type]).fetchall()
    finally:
        conn.close()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = type

    if rows:
        # Write header row from column names
        headers = list(rows[0].keys())
        ws.append(headers)
        for row in rows:
            ws.append([row[col] for col in headers])
    else:
        ws.append(["No data available"])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"{type}.xlsx"
    headers_resp = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers_resp,
    )
