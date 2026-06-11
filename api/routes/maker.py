"""메이커(Maker) 전문기술 — 제작 정보 / 시뮬레이터 데이터 / 재료 획득처"""
import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Query

from crawler.db import get_connection
from api.routes.mapleland_reference import id_filter_sql

router = APIRouter()

_MAKER_DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "maker_data.json"


@lru_cache(maxsize=1)
def _maker_data() -> dict:
    try:
        with open(_MAKER_DATA_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[maker] 데이터 로드 실패: {e}")
        return {}


@router.get("/maker/data")
def get_maker_data():
    """메이커 전체 참고 데이터(스킬/가공·제련 확률·보석/크리스탈/몬스터결정/주문서/장비 레시피)."""
    data = _maker_data()
    if not data:
        return {"error": "데이터를 불러올 수 없습니다.", "equipment": [], "gems": []}
    return data


@router.get("/maker/material-sources")
def get_material_sources(
    level_min: int = Query(..., ge=1, le=200),
    level_max: int = Query(..., ge=1, le=200),
    limit: int = Query(default=60, ge=1, le=200),
):
    """몬스터 결정 재료(전리품) 획득처 — 해당 레벨대의 메이플랜드 몬스터 목록."""
    try:
        conn = get_connection()
    except Exception:
        return {"mobs": [], "level_min": level_min, "level_max": level_max}

    try:
        conditions = ["level >= ?", "level <= ?", "COALESCE(is_hidden,0) = 0"]
        params: list = [level_min, level_max]
        ml_filter = id_filter_sql("id", "mobs")
        if ml_filter:
            conditions.append(ml_filter)
        where = "WHERE " + " AND ".join(conditions)
        rows = conn.execute(
            f"""
            SELECT id, name, level, is_boss,
                   (SELECT name_en FROM entity_names_en
                     WHERE entity_type='mob' AND entity_id=mobs.id AND source='kms') AS name_kr
            FROM mobs
            {where}
            ORDER BY level, name
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()
        mobs = []
        for r in rows:
            m = dict(r)
            m["name_kr"] = m.get("name_kr") or m.get("name")
            mobs.append(m)
        return {"mobs": mobs, "level_min": level_min, "level_max": level_max, "count": len(mobs)}
    except Exception as e:
        print(f"[maker] material-sources 오류: {e}")
        return {"mobs": [], "level_min": level_min, "level_max": level_max}
    finally:
        conn.close()
