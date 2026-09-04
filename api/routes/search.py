"""FTS5 full-text search across public entities with detail pages."""
import logging

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from crawler.db import get_connection
from api.routes.mapleland_reference import search_entity_filter_sql

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_TYPES = {"item", "mob", "map", "npc", "quest", "skill"}


def _like_fallback_where(column: str, query: str) -> tuple[str, list]:
    """FTS가 못 찾은 검색어의 중간 문자열 보완 조건.

    공백 차이를 무시하고("드래곤스트라이크" ↔ "드래곤 스트라이크"),
    여러 단어는 토큰별 AND로 매칭한다("자쿰 투구" → "자쿰의 투구").
    """
    tokens = query.split() or [query]
    clauses: list[str] = []
    params: list = []
    for token in tokens:
        clauses.append(f"REPLACE({column}, ' ', '') LIKE ?")
        params.append(f"%{token.replace(' ', '')}%")
    return " AND ".join(clauses), params


def _search_posts(conn, query: str, limit: int) -> list:
    """길드 정보공유 게시판(info_posts) 글 검색 — 글 수가 적어 공백 무시 토큰 AND LIKE로 충분하다."""
    tokens = query.split() or [query]
    clauses: list[str] = []
    params: list = []
    for token in tokens:
        clauses.append("(REPLACE(title, ' ', '') LIKE ? OR REPLACE(content, ' ', '') LIKE ?)")
        pattern = f"%{token.replace(' ', '')}%"
        params += [pattern, pattern]
    try:
        return conn.execute(
            f"""SELECT id, title, content FROM info_posts
                WHERE {" AND ".join(clauses)}
                ORDER BY upvotes DESC, created_at DESC
                LIMIT ?""",
            params + [limit],
        ).fetchall()
    except Exception:
        # info_posts가 없는 환경에서도 엔티티 검색은 동작해야 한다
        logger.exception("info_posts search failed")
        return []


def _post_snippet(content: str, query: str) -> str:
    flat = " ".join(content.split())
    token = (query.split() or [query])[0]
    idx = flat.lower().find(token.lower())
    if idx < 0:
        return flat[:180]
    start = max(idx - 40, 0)
    return flat[start:start + 180]


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

    # 게시판 글만 검색하는 경우 — 엔티티 FTS는 건너뛴다
    if type == "post":
        try:
            for row in _search_posts(conn, query, limit):
                suggestions.append({
                    "entity_type": "post",
                    "entity_id": row["id"],
                    "name": row["title"],
                    "name_kr": None,
                    "icon_url": None,
                    "variant_count": 1,
                })
        finally:
            conn.close()
        return {"suggestions": suggestions}

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
            like_where, en_params = _like_fallback_where("e.name_en", query)
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
                      AND """ + like_where + """
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

        # 타입 필터가 없으면 정보공유 게시판 글도 함께 제안 (상위 3건)
        if type is None:
            for row in _search_posts(conn, query, 3):
                suggestions.append({
                    "entity_type": "post",
                    "entity_id": row["id"],
                    "name": row["title"],
                    "name_kr": None,
                    "icon_url": None,
                    "variant_count": 1,
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

    # 게시판 글만 검색하는 경우 — 엔티티 FTS는 건너뛴다
    if type == "post":
        try:
            post_rows = _search_posts(conn, query, per_page) if page == 1 else []
        finally:
            conn.close()
        results = [
            {
                "entity_type": "post",
                "entity_id": row["id"],
                "name": row["title"],
                "name_kr": None,
                "snippet": _post_snippet(row["content"] or "", query),
                "variant_count": 1,
            }
            for row in post_rows
        ]
        return {"results": results, "total": len(results), "page": page, "per_page": per_page}

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
            en_where, en_params = _like_fallback_where("name_en", query)
            en_where = f"({en_where})"
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

        # 타입 필터가 없으면 첫 페이지에 정보공유 게시판 글도 포함 (글 수가 적어 페이지네이션 생략)
        if type is None and page == 1:
            post_rows = _search_posts(conn, query, 10)
            for row in post_rows:
                results.append({
                    "entity_type": "post",
                    "entity_id": row["id"],
                    "name": row["title"],
                    "name_kr": None,
                    "snippet": _post_snippet(row["content"] or "", query),
                    "variant_count": 1,
                })
            total += len(post_rows)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("search failed")
        raise HTTPException(status_code=503, detail="Search unavailable") from exc
    finally:
        conn.close()

    return {"results": results, "total": total, "page": page, "per_page": per_page}
