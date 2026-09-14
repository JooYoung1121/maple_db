"""Sourced acquisition guides enriched with the site's real quest/item records."""
import json
from functools import lru_cache
from crawler.catalog_data import DATA_DIR
from api.routes.mapleland_reference import mapleland_ids


@lru_cache(maxsize=1)
def guide_catalog():
    return json.loads((DATA_DIR / "skill_acquisition_guides.json").read_text(encoding="utf-8"))


def enriched_guides(conn):
    catalog = guide_catalog()
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    quests = {}
    if "mapledb_quests" in tables:
        quests = {row["quest_id"]: dict(row) for row in conn.execute(
            "SELECT quest_id,name,start_npc,requirements_json FROM mapledb_quests"
        )}
    skills = [dict(row) for row in conn.execute("SELECT id,skill_name,job_class FROM skills")]
    item_ids = {row[0] for row in conn.execute("SELECT id FROM items WHERE COALESCE(is_hidden,0)=0")}
    mob_ids = {row[0] for row in conn.execute("SELECT id FROM mobs WHERE COALESCE(is_hidden,0)=0")}
    for available, kind in [(item_ids, "items"), (mob_ids, "mobs")]:
        public = set(mapleland_ids(kind))
        if public:
            available.intersection_update(public)
    guides = []
    for guide in catalog["guides"]:
        entry = {**guide, "db_quests": [], "skills": [], "books": []}
        families = {family for family, jobs in catalog["job_groups"].items() if set(jobs) & set(guide["jobs"])}
        wanted = {name.replace(" ", "") for name in guide["skill_names"]}
        entry["skills"] = [s for s in skills if s["skill_name"].replace(" ", "") in wanted and s["job_class"] in families | set(guide["jobs"])]
        for quest_id in guide["quest_ids"]:
            quest = quests.get(quest_id)
            if not quest:
                continue
            requirements = []
            for req in json.loads(quest["requirements_json"] or "[]"):
                href = None
                if req.get("type") == "item" and req.get("id") in item_ids:
                    href = f'/items/{req["id"]}'
                elif req.get("type") == "mob" and req.get("id") in mob_ids:
                    href = f'/mobs/{req["id"]}'
                requirements.append({**req, "href": href})
            # These are mapledb quest IDs, not the legacy IDs used by /quests/{id}.
            entry["db_quests"].append({"id": quest_id, "name": quest["name"], "start_npc": quest["start_npc"], "requirements": requirements})
        for item_id in guide["item_ids"]:
            if item_id in item_ids:
                entry["books"].append({"id": item_id, "href": f"/items/{item_id}"})
        guides.append(entry)
    return {**catalog, "guides": guides, "quest_database_available": "mapledb_quests" in tables}
