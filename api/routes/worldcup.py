"""이상형 월드컵 — 후보 추첨 + 우승 통계

결과 저장은 기존 범용 game_results(game_type='worldcup_mob'|'worldcup_item')를 재사용.
"""
from fastapi import APIRouter, Query, HTTPException

from crawler.db import get_connection
from api.routes.mapleland_reference import id_filter_sql

router = APIRouter()

MODES = {"mob", "item"}
# 코디/외형 월드컵 대상 카테고리 (아이템 모드)
ITEM_CATEGORIES = ("Armor", "Accessory", "One-Handed Weapon", "Two-Handed Weapon")


@router.get("/worldcup/candidates")
def worldcup_candidates(mode: str = Query(...), count: int = Query(default=32, ge=8, le=64)):
    if mode not in MODES:
        raise HTTPException(status_code=400, detail="mode는 mob 또는 item")
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        if mode == "mob":
            flt = id_filter_sql("m.id", "mobs")
            # 보스 부위(팔·다리·머리 등)·훈련용 더미는 월드컵 후보에서 제외
            part_filter = """
                AND NOT EXISTS (
                    SELECT 1 FROM entity_names_en e
                    WHERE e.entity_type='mob' AND e.entity_id=m.id AND e.source='kms'
                      AND (e.name_en LIKE '%팔1' OR e.name_en LIKE '%팔2' OR e.name_en LIKE '%팔3'
                           OR e.name_en LIKE '%팔4' OR e.name_en LIKE '%팔5' OR e.name_en LIKE '%팔6'
                           OR e.name_en LIKE '%팔7' OR e.name_en LIKE '%팔8'
                           OR e.name_en LIKE '%의 다리' OR e.name_en LIKE '%의 머리%'
                           OR e.name_en LIKE '%훈련용%' OR e.name_en LIKE '%허수아비%')
                )
            """
            where = f"WHERE m.icon_url IS NOT NULL AND m.id < 9000000 {f'AND {flt}' if flt else ''} {part_filter}"
            rows = conn.execute(
                f"""SELECT m.id, m.icon_url,
                           (SELECT name_en FROM entity_names_en
                            WHERE entity_type='mob' AND entity_id=m.id AND source='kms') AS name_kr,
                           m.name, m.level
                    FROM mobs m {where}
                    ORDER BY RANDOM() LIMIT ?""",
                (count,),
            ).fetchall()
            cands = [
                {
                    "id": r["id"],
                    "name": r["name_kr"] or r["name"],
                    "img": f"https://maplestory.io/api/gms/92/mob/{r['id']}/render",
                    "fallback_img": r["icon_url"],
                    "sub": f"Lv.{r['level']}" if r["level"] else None,
                }
                for r in rows
            ]
        else:
            flt = id_filter_sql("i.id", "items")
            cat_ph = ",".join("?" for _ in ITEM_CATEGORIES)
            where = f"WHERE i.icon_url IS NOT NULL AND i.category IN ({cat_ph}) {f'AND {flt}' if flt else ''}"
            rows = conn.execute(
                f"""SELECT i.id, i.icon_url, i.category, i.level_req,
                           (SELECT name_en FROM entity_names_en
                            WHERE entity_type='item' AND entity_id=i.id AND source='kms') AS name_kr,
                           i.name
                    FROM items i {where}
                    ORDER BY RANDOM() LIMIT ?""",
                (*ITEM_CATEGORIES, count),
            ).fetchall()
            cands = [
                {
                    "id": r["id"],
                    "name": (r["name_kr"] or r["name"] or "").strip(),
                    "img": r["icon_url"],
                    "fallback_img": r["icon_url"],
                    "sub": f"Lv.{r['level_req']}" if r["level_req"] else None,
                }
                for r in rows
            ]
    finally:
        conn.close()
    return {"candidates": cands}


@router.get("/worldcup/stats")
def worldcup_stats(mode: str = Query(...), limit: int = Query(default=10, ge=1, le=30)):
    if mode not in MODES:
        raise HTTPException(status_code=400, detail="mode는 mob 또는 item")
    try:
        conn = get_connection()
    except Exception:
        return {"total": 0, "top": []}
    try:
        game_type = f"worldcup_{mode}"
        total = conn.execute(
            "SELECT COUNT(*) FROM game_results WHERE game_type = ?", (game_type,)
        ).fetchone()[0]
        rows = conn.execute(
            """SELECT winner, COUNT(*) AS wins,
                      MAX(json_extract(result_json, '$.winner_id')) AS winner_id
               FROM game_results WHERE game_type = ?
               GROUP BY winner ORDER BY wins DESC LIMIT ?""",
            (game_type, limit),
        ).fetchall()
        top = [
            {"name": r["winner"], "wins": r["wins"], "id": r["winner_id"],
             "rate": round(r["wins"] * 100 / total, 1) if total else 0}
            for r in rows
        ]
    finally:
        conn.close()
    return {"total": total, "top": top}
