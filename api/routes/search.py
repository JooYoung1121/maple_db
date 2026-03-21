"""FTS5 full-text search across all entity types"""
from fastapi import APIRouter, Query
from typing import Optional

from crawler.db import get_connection

router = APIRouter()

VALID_TYPES = {"item", "mob", "map", "npc", "quest", "blog"}


@router.get("/search/suggest")
def search_suggest(
    q: str = Query(default=""),
    limit: int = Query(default=10, ge=1, le=30),
):
    """Lightweight autocomplete endpoint — no snippets, fast response."""
    if not q.strip():
        return {"suggestions": []}

    query = q.strip()

    try:
        conn = get_connection()
    except Exception:
        return {"suggestions": []}

    suggestions: list[dict] = []
    try:
        # FTS5 prefix search + JOIN으로 KMS name, icon_url을 한 번에 가져옴
        fts_query = query + "*"
        fts_rows = conn.execute(
            """SELECT s.entity_type, s.entity_id, s.name,
                      en.name_en AS name_kr,
                      CASE s.entity_type
                          WHEN 'item' THEN (SELECT icon_url FROM items WHERE id = s.entity_id)
                          WHEN 'mob'  THEN (SELECT icon_url FROM mobs WHERE id = s.entity_id)
                          WHEN 'npc'  THEN (SELECT icon_url FROM npcs WHERE id = s.entity_id)
                      END AS icon_url
               FROM search_index s
               LEFT JOIN entity_names_en en
                 ON en.entity_type = s.entity_type
                AND en.entity_id = s.entity_id
                AND en.source = 'kms'
               WHERE search_index MATCH ?
                 AND NOT (s.entity_type = 'mob'
                          AND EXISTS (SELECT 1 FROM mobs WHERE id = s.entity_id AND COALESCE(is_hidden,0)=1))
               ORDER BY rank
               LIMIT ?""",
            [fts_query, limit],
        ).fetchall()

        seen = set()
        for row in fts_rows:
            key = (row["entity_type"], row["entity_id"])
            if key in seen:
                continue
            seen.add(key)
            suggestions.append({
                "entity_type": row["entity_type"],
                "entity_id": row["entity_id"],
                "name": row["name"],
                "name_kr": row["name_kr"],
                "icon_url": row["icon_url"],
            })

        # Fallback: LIKE on entity_names_en if not enough results
        if len(suggestions) < limit:
            remaining = limit - len(suggestions)
            en_rows = conn.execute(
                """SELECT DISTINCT e.entity_type, e.entity_id, e.name_en,
                    CASE e.entity_type
                        WHEN 'item' THEN (SELECT name FROM items WHERE id = e.entity_id)
                        WHEN 'mob'  THEN (SELECT name FROM mobs WHERE id = e.entity_id)
                        WHEN 'map'  THEN (SELECT name FROM maps WHERE id = e.entity_id)
                        WHEN 'npc'  THEN (SELECT name FROM npcs WHERE id = e.entity_id)
                        WHEN 'quest' THEN (SELECT name FROM quests WHERE id = e.entity_id)
                    END as name
                FROM entity_names_en e
                WHERE name_en LIKE ?
                LIMIT ?""",
                [f"%{query}%", remaining],
            ).fetchall()

            for row in en_rows:
                key = (row["entity_type"], row["entity_id"])
                if key not in seen:
                    seen.add(key)
                    suggestions.append({
                        "entity_type": row["entity_type"],
                        "entity_id": row["entity_id"],
                        "name": row["name"] or row["name_en"],
                        "name_kr": row["name_en"],
                        "icon_url": None,
                    })
    except Exception:
        suggestions = []
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
    except Exception:
        return {"results": [], "total": 0, "page": page, "per_page": per_page}

    try:
        # FTS5 검색 (한국어 + 영문명 모두 content에 포함됨)
        fts_query = query + "*"
        base_where = "search_index MATCH ?"
        params: list = [fts_query]

        if type and type in VALID_TYPES:
            base_where += " AND entity_type = ?"
            params.append(type)

        # Total count
        count_sql = f"SELECT COUNT(*) FROM search_index WHERE {base_where}"
        total = conn.execute(count_sql, params).fetchone()[0]

        # Results
        data_sql = f"""
            SELECT entity_type, entity_id, name,
                   snippet(search_index, 3, '<b>', '</b>', '...', 20) AS snippet
            FROM search_index
            WHERE {base_where}
            ORDER BY rank
            LIMIT ? OFFSET ?
        """
        rows = conn.execute(data_sql, params + [per_page, offset]).fetchall()

        results = [
            {
                "entity_type": row["entity_type"],
                "entity_id": row["entity_id"],
                "name": row["name"],
                "snippet": row["snippet"],
            }
            for row in rows
        ]

        # FTS에서 결과가 적으면 entity_names_en에서 영문명 직접 LIKE 검색 보완
        if total < per_page:
            en_where = "name_en LIKE ?"
            en_params: list = [f"%{query}%"]
            if type and type in VALID_TYPES:
                en_where += " AND entity_type = ?"
                en_params.append(type)

            # 이미 찾은 entity_id 제외
            found_ids = {(r["entity_type"], r["entity_id"]) for r in results}

            en_rows = conn.execute(
                f"""SELECT DISTINCT e.entity_type, e.entity_id, e.name_en,
                    CASE e.entity_type
                        WHEN 'item' THEN (SELECT name FROM items WHERE id = e.entity_id)
                        WHEN 'mob'  THEN (SELECT name FROM mobs WHERE id = e.entity_id)
                        WHEN 'map'  THEN (SELECT name FROM maps WHERE id = e.entity_id)
                        WHEN 'npc'  THEN (SELECT name FROM npcs WHERE id = e.entity_id)
                        WHEN 'quest' THEN (SELECT name FROM quests WHERE id = e.entity_id)
                    END as name
                FROM entity_names_en e
                WHERE {en_where}
                LIMIT ?""",
                en_params + [per_page - len(results)],
            ).fetchall()

            for row in en_rows:
                key = (row["entity_type"], row["entity_id"])
                if key not in found_ids:
                    results.append({
                        "entity_type": row["entity_type"],
                        "entity_id": row["entity_id"],
                        "name": row["name"] or row["name_en"],
                        "snippet": row["name_en"],
                    })
                    total += 1
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"results": results, "total": total, "page": page, "per_page": per_page}
