"""메랜 브레인 — 그래프 탐색 API.

캐릭터(레벨) 중심 ego 그래프와 노드 확장(맵→몹, 몹→드랍/출현맵, 아이템→드랍몹,
퀘스트→보상/NPC)을 제공한다. 노드 id는 "type:entity_id" 네임스페이스 문자열.

사냥터 스코어는 원작 수치 기반 근사치: Σ(몹 exp × 젠 수), 레벨 창 [level-4, level+6].
"""
import json

from fastapi import APIRouter, HTTPException, Query

from crawler.db import get_connection
from api.routes.mapleland_reference import id_filter_sql, mapleland_name_kr_map

router = APIRouter()

LEVEL_WINDOW_DOWN = 4
LEVEL_WINDOW_UP = 6


import re

_skill_icon_cache: dict[str, str | None] = {}


def _mastery_book_icon(conn, item_label: str) -> str | None:
    """[마스터리북] 아이템 → 해당 스킬 아이콘 경로 (sim_skills 로컬 아이콘)."""
    m = re.match(r"\[마스터리북\]\s*(.+?)\s*\d*$", item_label or "")
    if not m:
        return None
    key = re.sub(r"\s+", "", m.group(1))
    if key in _skill_icon_cache:
        return _skill_icon_cache[key]
    row = conn.execute(
        "SELECT icon_path FROM sim_skills WHERE REPLACE(name, ' ', '') = ? AND icon_path IS NOT NULL LIMIT 1",
        (key,),
    ).fetchone()
    icon = row["icon_path"] if row else None
    _skill_icon_cache[key] = icon
    return icon


def _kr(conn, entity_type: str, entity_id: int) -> str | None:
    row = conn.execute(
        "SELECT name_en FROM entity_names_en WHERE entity_type=? AND entity_id=? AND source='kms'",
        (entity_type, entity_id),
    ).fetchone()
    return row["name_en"] if row else None


def _map_label(conn, map_id: int, fallback: str | None = None) -> str:
    ref = mapleland_name_kr_map("maps").get(map_id)
    if ref:
        return ref.split(":", 1)[-1].strip()
    return _kr(conn, "map", map_id) or fallback or str(map_id)


def _hunting_maps(conn, level: int, limit: int = 6) -> list[dict]:
    """레벨 창 내 몹의 exp × 젠 수 합으로 맵 랭킹."""
    maps_filter = id_filter_sql("s.map_id", "maps")
    mobs_filter = id_filter_sql("m.id", "mobs")
    where = [
        "m.level BETWEEN ? AND ?",
        "m.exp > 0",
        "m.id < 9000000",
        "COALESCE(m.is_hidden, 0) = 0",
        "m.is_boss = 0",
    ]
    if maps_filter:
        where.append(maps_filter)
    if mobs_filter:
        where.append(mobs_filter)
    rows = conn.execute(
        f"""SELECT s.map_id,
                   MAX(s.map_name) AS map_name,
                   SUM(m.exp * COALESCE(s.spawn_count, 1)) AS score,
                   SUM(COALESCE(s.spawn_count, 1)) AS total_spawn,
                   COUNT(DISTINCT s.mob_id) AS mob_kinds
            FROM mob_spawns s JOIN mobs m ON m.id = s.mob_id
            WHERE {' AND '.join(where)}
            GROUP BY s.map_id
            ORDER BY score DESC
            LIMIT ?""",
        [max(1, level - LEVEL_WINDOW_DOWN), level + LEVEL_WINDOW_UP, limit],
    ).fetchall()
    out = []
    for r in rows:
        out.append({
            "id": f"map:{r['map_id']}",
            "type": "map",
            "entity_id": r["map_id"],
            "label": _map_label(conn, r["map_id"], r["map_name"]),
            "sub": f"젠 {r['total_spawn']} · 몹 {r['mob_kinds']}종",
            "score": r["score"],
            "detail_url": f"/maps/{r['map_id']}",
        })
    return out


def _quests_for_level(conn, level: int, limit: int = 5) -> list[dict]:
    rows = conn.execute(
        """SELECT quest_id, name, min_level, exp, meso
           FROM mapledb_quests
           WHERE min_level <= ? AND min_level >= ?
             AND (max_level IS NULL OR max_level = 0 OR max_level >= ?)
             AND exp > 0
           ORDER BY exp DESC LIMIT ?""",
        [level, max(1, level - 12), level, limit],
    ).fetchall()
    return [
        {
            "id": f"quest:{r['quest_id']}",
            "type": "quest",
            "entity_id": r["quest_id"],
            "label": r["name"],
            "sub": f"Lv.{r['min_level']}+ · EXP {r['exp']:,}",
            "detail_url": "/quest-roadmap",
        }
        for r in rows
    ]


@router.get("/brain/ego")
def brain_ego(level: int = Query(ge=1, le=200), job: str = Query(default="")):
    """캐릭터 중심 초기 그래프: 지금 사냥터 + 추천 퀘스트 + 다음 목표."""
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=500, detail="DB 연결 실패")
    try:
        char_id = "char:me"
        nodes = [{
            "id": char_id,
            "type": "char",
            "entity_id": 0,
            "label": f"Lv.{level}" + (f" {job}" if job else ""),
            "sub": "내 캐릭터",
        }]
        links = []

        for n in _hunting_maps(conn, level, limit=6):
            n["group"] = "hunt"
            nodes.append(n)
            links.append({"source": char_id, "target": n["id"], "kind": "hunt"})

        for n in _quests_for_level(conn, level, limit=5):
            n["group"] = "quest"
            nodes.append(n)
            links.append({"source": char_id, "target": n["id"], "kind": "quest"})

        next_level = min(level + 5, 200)
        if next_level > level:
            next_id = f"goal:{next_level}"
            nodes.append({
                "id": next_id,
                "type": "goal",
                "entity_id": next_level,
                "label": f"Lv.{next_level} 목표",
                "sub": "다음 구간 사냥터",
            })
            links.append({"source": char_id, "target": next_id, "kind": "goal"})
            for n in _hunting_maps(conn, next_level, limit=3):
                if any(x["id"] == n["id"] for x in nodes):
                    links.append({"source": next_id, "target": n["id"], "kind": "hunt"})
                    continue
                n["group"] = "next"
                nodes.append(n)
                links.append({"source": next_id, "target": n["id"], "kind": "hunt"})

        return {"nodes": nodes, "links": links}
    finally:
        conn.close()


@router.get("/brain/expand")
def brain_expand(type: str = Query(pattern="^(map|mob|item|quest)$"), id: int = Query()):
    """노드 확장: 연결된 노드/링크 반환 (기존 그래프에 병합용)."""
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=500, detail="DB 연결 실패")
    try:
        src = f"{type}:{id}"
        nodes: list[dict] = []
        links: list[dict] = []

        if type == "map":
            mobs_filter = id_filter_sql("m.id", "mobs")
            extra = f"AND {mobs_filter}" if mobs_filter else ""
            rows = conn.execute(
                f"""SELECT m.id, m.level, m.exp, m.icon_url, COALESCE(s.spawn_count,1) AS cnt
                    FROM mob_spawns s JOIN mobs m ON m.id = s.mob_id
                    WHERE s.map_id = ? AND m.id < 9000000 AND COALESCE(m.is_hidden,0)=0 {extra}
                    ORDER BY cnt DESC""",
                [id],
            ).fetchall()
            for r in rows:
                nodes.append({
                    "id": f"mob:{r['id']}", "type": "mob", "entity_id": r["id"],
                    "label": _kr(conn, "mob", r["id"]) or str(r["id"]),
                    "sub": f"Lv.{r['level']} · 젠 {r['cnt']} · EXP {r['exp']}",
                    "icon": r["icon_url"], "detail_url": f"/mobs/{r['id']}",
                })
                links.append({"source": src, "target": f"mob:{r['id']}", "kind": "spawn"})

        elif type == "mob":
            items_filter = id_filter_sql("i.id", "items")
            extra = f"AND {items_filter}" if items_filter else ""
            rows = conn.execute(
                f"""SELECT i.id, i.icon_url, d.drop_rate
                    FROM mob_drops d JOIN items i ON i.id = d.item_id
                    WHERE d.mob_id = ? {extra}
                    ORDER BY d.drop_rate IS NULL, d.drop_rate DESC""",
                [id],
            ).fetchall()
            for r in rows:
                rate = r["drop_rate"]
                rate_txt = (f"{rate * 100:.2f}%" if rate < 0.1 else f"{rate * 100:.0f}%") if rate else "확률 미상"
                label = _kr(conn, "item", r["id"]) or str(r["id"])
                icon = _mastery_book_icon(conn, label) or r["icon_url"]
                nodes.append({
                    "id": f"item:{r['id']}", "type": "item", "entity_id": r["id"],
                    "label": label,
                    "sub": f"드랍 {rate_txt}",
                    "icon": icon, "detail_url": f"/items/{r['id']}",
                })
                links.append({"source": src, "target": f"item:{r['id']}", "kind": "drop"})
            maps_filter = id_filter_sql("s.map_id", "maps")
            extra = f"AND {maps_filter}" if maps_filter else ""
            rows = conn.execute(
                f"""SELECT s.map_id, s.map_name, COALESCE(s.spawn_count,1) AS cnt
                    FROM mob_spawns s WHERE s.mob_id = ? {extra}
                    ORDER BY cnt DESC""",
                [id],
            ).fetchall()
            for r in rows:
                nodes.append({
                    "id": f"map:{r['map_id']}", "type": "map", "entity_id": r["map_id"],
                    "label": _map_label(conn, r["map_id"], r["map_name"]),
                    "sub": f"젠 {r['cnt']}",
                    "detail_url": f"/maps/{r['map_id']}",
                })
                links.append({"source": src, "target": f"map:{r['map_id']}", "kind": "spawn"})

        elif type == "item":
            mobs_filter = id_filter_sql("m.id", "mobs")
            extra = f"AND {mobs_filter}" if mobs_filter else ""
            rows = conn.execute(
                f"""SELECT m.id, m.level, m.icon_url, d.drop_rate
                    FROM mob_drops d JOIN mobs m ON m.id = d.mob_id
                    WHERE d.item_id = ? AND m.id < 9000000 AND COALESCE(m.is_hidden,0)=0 {extra}
                    ORDER BY d.drop_rate IS NULL, d.drop_rate DESC""",
                [id],
            ).fetchall()
            for r in rows:
                rate = r["drop_rate"]
                rate_txt = (f"{rate * 100:.2f}%" if rate < 0.1 else f"{rate * 100:.0f}%") if rate else "확률 미상"
                nodes.append({
                    "id": f"mob:{r['id']}", "type": "mob", "entity_id": r["id"],
                    "label": _kr(conn, "mob", r["id"]) or str(r["id"]),
                    "sub": f"Lv.{r['level']} · 드랍 {rate_txt}",
                    "icon": r["icon_url"], "detail_url": f"/mobs/{r['id']}",
                })
                links.append({"source": src, "target": f"mob:{r['id']}", "kind": "drop"})

        elif type == "quest":
            row = conn.execute(
                "SELECT * FROM mapledb_quests WHERE quest_id = ?", [id]
            ).fetchone()
            if row:
                if row["start_npc_id"]:
                    npc = conn.execute(
                        "SELECT id, icon_url FROM npcs WHERE id = ?", [row["start_npc_id"]]
                    ).fetchone()
                    nodes.append({
                        "id": f"npc:{row['start_npc_id']}", "type": "npc",
                        "entity_id": row["start_npc_id"],
                        "label": row["start_npc"] or _kr(conn, "npc", row["start_npc_id"]) or "시작 NPC",
                        "sub": "퀘스트 시작 NPC",
                        "icon": npc["icon_url"] if npc else None,
                        "detail_url": f"/npcs/{row['start_npc_id']}",
                    })
                    links.append({"source": src, "target": f"npc:{row['start_npc_id']}", "kind": "npc"})
                try:
                    rewards = json.loads(row["rewards_json"] or "[]")
                except Exception:
                    rewards = []
                for rw in rewards[:6]:
                    if rw.get("type") == "item" and rw.get("id"):
                        iid = int(rw["id"])
                        it = conn.execute("SELECT icon_url FROM items WHERE id = ?", [iid]).fetchone()
                        label = rw.get("name") or _kr(conn, "item", iid) or str(iid)
                        nodes.append({
                            "id": f"item:{iid}", "type": "item", "entity_id": iid,
                            "label": label,
                            "sub": "퀘스트 보상",
                            "icon": _mastery_book_icon(conn, label) or (it["icon_url"] if it else None),
                            "detail_url": f"/items/{iid}",
                        })
                        links.append({"source": src, "target": f"item:{iid}", "kind": "reward"})

        return {"nodes": nodes, "links": links}
    finally:
        conn.close()
