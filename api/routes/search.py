"""FTS5 full-text search across public entities with detail pages."""
import logging

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from crawler.db import get_connection
from api.routes.mapleland_reference import search_entity_filter_sql

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_TYPES = {"item", "mob", "map", "npc", "quest", "skill"}


def _base_filters(type_filter: Optional[str]) -> tuple[str, list]:
    where = "search_index MATCH ?"
    params: list = []
    if type_filter and type_filter in VALID_TYPES:
        where += " AND s.entity_type = ?"
        params.append(type_filter)

    mapleland_filter = search_entity_filter_sql("s.entity_type", "s.entity_id")
    if mapleland_filter:
        where += f" AND {mapleland_filter}"
    where += """
        AND NOT (
            s.entity_type = 'mob'
            AND EXISTS (
                SELECT 1 FROM mobs
                WHERE id = s.entity_id AND COALESCE(is_hidden, 0) = 1
            )
        )
    """
    return where, params


@router.get("/search/suggest")
def search_suggest(
    q: str = Query(default=""),
    limit: int = Query(default=10, ge=1, le=30),
    type: Optional[str] = Query(default=None),
):
    """Lightweight autocomplete endpoint — no snippets, fast response."""
    if not q.strip():
        return {"suggestions": []}

    query = q.strip()

    try:
        conn = get_connection()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Search unavailable") from exc

    suggestions: list[dict] = []
    try:
        # 동일 표시명은 대표 1건으로 묶고 실제 변형 수를 함께 반환한다.
        fts_query = query + "*"
        base_where, filter_params = _base_filters(type)
        fts_rows = conn.execute(
            f"""
            WITH matches AS (
                SELECT
                    s.entity_type,
                    s.entity_id,
                    s.name,
                    en.name_en AS name_kr,
                    rank AS search_rank,
                    COUNT(*) OVER (
                        PARTITION BY s.entity_type, COALESCE(en.name_en, s.name)
                    ) AS variant_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY s.entity_type, COALESCE(en.name_en, s.name)
                        ORDER BY rank, s.entity_id
                    ) AS variant_rank
                FROM search_index s
                LEFT JOIN entity_names_en en
                  ON en.entity_type = s.entity_type
                 AND en.entity_id = s.entity_id
                 AND en.source = 'kms'
                WHERE {base_where}
            )
            SELECT
                entity_type,
                entity_id,
                name,
                name_kr,
                variant_count,
                CASE entity_type
                    WHEN 'item' THEN (SELECT icon_url FROM items WHERE id = entity_id)
                    WHEN 'mob'  THEN (SELECT icon_url FROM mobs WHERE id = entity_id)
                    WHEN 'npc'  THEN (SELECT icon_url FROM npcs WHERE id = entity_id)
                END AS icon_url
            FROM matches
            WHERE variant_rank = 1
            ORDER BY search_rank
            LIMIT ?
            """,
            [fts_query, *filter_params, limit],
        ).fetchall()

        for row in fts_rows:
            suggestions.append({
                "entity_type": row["entity_type"],
                "entity_id": row["entity_id"],
                "name": row["name"],
                "name_kr": row["name_kr"],
                "icon_url": row["icon_url"],
                "variant_count": row["variant_count"],
            })

        # FTS가 전혀 못 찾은 중간 문자열 검색만 LIKE로 보완한다.
        if not suggestions:
            en_filter = search_entity_filter_sql("e.entity_type", "e.entity_id")
            en_extra_filter = f"AND {en_filter}" if en_filter else ""
            en_type_filter = ""
            en_params: list = [f"%{query}%"]
            if type and type in VALID_TYPES:
                en_type_filter = "AND e.entity_type = ?"
                en_params.append(type)
            en_rows = conn.execute(
                """WITH grouped AS (
                    SELECT
                        e.entity_type,
                        MIN(e.entity_id) AS entity_id,
                        e.name_en,
                        COUNT(*) AS variant_count
                    FROM entity_names_en e
                    WHERE e.entity_type IN ('item','mob','map','npc','quest','skill')
                      AND e.name_en LIKE ?
                    """ + en_type_filter + """
                    """ + en_extra_filter + """
                    GROUP BY e.entity_type, e.name_en
                    LIMIT ?
                )
                SELECT g.entity_type, g.entity_id, g.name_en, g.variant_count,
                    CASE g.entity_type
                        WHEN 'item' THEN (SELECT name FROM items WHERE id = g.entity_id)
                        WHEN 'mob'  THEN (SELECT name FROM mobs WHERE id = g.entity_id)
                        WHEN 'map'  THEN (SELECT name FROM maps WHERE id = g.entity_id)
                        WHEN 'npc'  THEN (SELECT name FROM npcs WHERE id = g.entity_id)
                        WHEN 'quest' THEN (SELECT name FROM quests WHERE id = g.entity_id)
                        WHEN 'skill' THEN (SELECT skill_name FROM skills WHERE id = g.entity_id)
                    END AS name
                FROM grouped g""",
                en_params + [limit],
            ).fetchall()

            for row in en_rows:
                suggestions.append({
                    "entity_type": row["entity_type"],
                    "entity_id": row["entity_id"],
                    "name": row["name"] or row["name_en"],
                    "name_kr": row["name_en"],
                    "icon_url": None,
                    "variant_count": row["variant_count"],
                })
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("search_suggest failed")
        raise HTTPException(status_code=503, detail="Search unavailable") from exc
    finally:
        conn.close()

    return {"suggestions": suggestions}


@router.get("/search")
def search(
    q: str = Query(default=""),
    type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    if not q.strip():
        return {"results": [], "total": 0, "page": page, "per_page": per_page}

    query = q.strip()
    offset = (page - 1) * per_page

    try:
        conn = get_connection()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Search unavailable") from exc

    try:
        # FTS5 검색 (한국어 + 영문명 모두 content에 포함됨)
        fts_query = query + "*"
        base_where, filter_params = _base_filters(type)
        params: list = [fts_query, *filter_params]

        # 동일 표시명 변형을 하나로 계산해 페이지 수와 실제 노출 수를 맞춘다.
        count_sql = f"""
            SELECT COUNT(*) FROM (
                SELECT s.entity_type, COALESCE(en.name_en, s.name)
                FROM search_index s
                LEFT JOIN entity_names_en en
                  ON en.entity_type = s.entity_type
                 AND en.entity_id = s.entity_id
                 AND en.source = 'kms'
                WHERE {base_where}
                GROUP BY s.entity_type, COALESCE(en.name_en, s.name)
            )
        """
        total = conn.execute(count_sql, params).fetchone()[0]

        # 대표 결과 + 같은 표시명의 실제 변형 수
        data_sql = f"""
            WITH matches AS (
                SELECT
                    s.entity_type,
                    s.entity_id,
                    s.name,
                    en.name_en AS name_kr,
                    SUBSTR(
                        s.content,
                        MAX(INSTR(LOWER(s.content), LOWER(?)) - 40, 1),
                        180
                    ) AS snippet,
                    rank AS search_rank,
                    COUNT(*) OVER (
                        PARTITION BY s.entity_type, COALESCE(en.name_en, s.name)
                    ) AS variant_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY s.entity_type, COALESCE(en.name_en, s.name)
                        ORDER BY rank, s.entity_id
                    ) AS variant_rank
                FROM search_index s
                LEFT JOIN entity_names_en en
                  ON en.entity_type = s.entity_type
                 AND en.entity_id = s.entity_id
                 AND en.source = 'kms'
                WHERE {base_where}
            )
            SELECT entity_type, entity_id, name, name_kr, snippet, variant_count
            FROM matches
            WHERE variant_rank = 1
            ORDER BY search_rank
            LIMIT ? OFFSET ?
        """
        rows = conn.execute(
            data_sql,
            [query, *params, per_page, offset],
        ).fetchall()

        results = [
            {
                "entity_type": row["entity_type"],
                "entity_id": row["entity_id"],
                "name": row["name"],
                "name_kr": row["name_kr"],
                "snippet": row["snippet"],
                "variant_count": row["variant_count"],
            }
            for row in rows
        ]

        # 첫 페이지에서 FTS가 전혀 못 찾았을 때만 중간 문자열 LIKE 보완
        if total == 0 and page == 1:
            en_where = "name_en LIKE ?"
            en_params: list = [f"%{query}%"]
            if type and type in VALID_TYPES:
                en_where += " AND entity_type = ?"
                en_params.append(type)

            en_filter = search_entity_filter_sql("e.entity_type", "e.entity_id")
            if en_filter:
                en_where += f" AND {en_filter}"

            en_rows = conn.execute(
                f"""WITH grouped AS (
                    SELECT
                        e.entity_type,
                        MIN(e.entity_id) AS entity_id,
                        e.name_en,
                        COUNT(*) AS variant_count
                    FROM entity_names_en e
                    WHERE e.entity_type IN ('item','mob','map','npc','quest','skill')
                      AND {en_where}
                    GROUP BY e.entity_type, e.name_en
                    LIMIT ?
                )
                SELECT g.entity_type, g.entity_id, g.name_en, g.variant_count,
                    CASE g.entity_type
                        WHEN 'item' THEN (SELECT name FROM items WHERE id = g.entity_id)
                        WHEN 'mob'  THEN (SELECT name FROM mobs WHERE id = g.entity_id)
                        WHEN 'map'  THEN (SELECT name FROM maps WHERE id = g.entity_id)
                        WHEN 'npc'  THEN (SELECT name FROM npcs WHERE id = g.entity_id)
                        WHEN 'quest' THEN (SELECT name FROM quests WHERE id = g.entity_id)
                        WHEN 'skill' THEN (SELECT skill_name FROM skills WHERE id = g.entity_id)
                    END AS name
                FROM grouped g""",
                en_params + [per_page],
            ).fetchall()

            for row in en_rows:
                results.append({
                    "entity_type": row["entity_type"],
                    "entity_id": row["entity_id"],
                    "name": row["name"] or row["name_en"],
                    "name_kr": row["name_en"],
                    "snippet": row["name_en"],
                    "variant_count": row["variant_count"],
                })
            total = len(results)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("search failed")
        raise HTTPException(status_code=503, detail="Search unavailable") from exc
    finally:
        conn.close()

    return {"results": results, "total": total, "page": page, "per_page": per_page}
