"""mapledb.kr NPC 파서"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from .base import BaseParser


class NpcParser(BaseParser):
    """
    목록: /npc.php
    상세: /search.php?q={id}&t=n
    """

    def parse_list(self, html: str) -> list[dict]:
        soup = self.make_soup(html)
        results = self.find_content_links(soup)
        if results:
            return results
        rows = self.find_table_rows(soup, table_index=0)
        for row in rows:
            try:
                cells = row.find_all("td")
                if len(cells) < 2:
                    continue
                link = row.find("a")
                entity_id = self.extract_id_from_link(link, "id") or \
                            self.extract_id_from_link(link, "no") or \
                            self.safe_int(self.text(cells[0]), 0) or None
                if entity_id is None:
                    continue
                name = self.text(link) if link else self.text(cells[1])
                results.append({"id": entity_id, "name": name})
            except Exception:
                continue
        return results

    def parse_detail(self, html: str, entity_id: int) -> dict:
        soup = self.make_soup(html)
        data: dict = {"id": entity_id}

        try:
            name_tag = soup.find("h1") or soup.find("h2") or soup.find(class_="npc-name")
            data["name"] = self.text(name_tag) if name_tag else ""

            info = self.parse_info_table(soup)

            data["description"] = info.get("설명", info.get("대사", ""))

            # 맵 ID / 맵 이름
            map_raw = info.get("위치", info.get("맵", info.get("출현지역", "")))
            # 링크에서 맵 ID 추출 시도
            map_link = None
            for table in soup.find_all("table"):
                headers = [self.text(th) for th in table.find_all("th")]
                if any(kw in " ".join(headers) for kw in ("위치", "맵", "출현")):
                    map_link = table.find("a")
                    break
            map_id = self.extract_id_from_link(map_link, "id") if map_link else self.safe_int(map_raw) or None
            map_name = self.text(map_link) if map_link else map_raw
            data["map_id"] = map_id
            data["map_name"] = map_name

            # 아이콘
            icon_img = soup.find("img", class_="npc-icon")
            if icon_img is None:
                for img in soup.find_all("img"):
                    src = img.get("src", "")
                    if "npc" in src.lower() or "icon" in src.lower():
                        icon_img = img
                        break
            data["icon_url"] = icon_img.get("src", "") if icon_img else ""

        except Exception:
            pass

        data["last_crawled_at"] = datetime.now(timezone.utc).isoformat()
        return data

    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            """
            INSERT OR REPLACE INTO npcs
                (id, name, map_id, map_name, description, icon_url, source_url, last_crawled_at)
            VALUES
                (:id, :name, :map_id, :map_name, :description, :icon_url, :source_url, :last_crawled_at)
            """,
            {
                "id": data.get("id"),
                "name": data.get("name", ""),
                "map_id": data.get("map_id"),
                "map_name": data.get("map_name"),
                "description": data.get("description"),
                "icon_url": data.get("icon_url"),
                "source_url": data.get("source_url"),
                "last_crawled_at": data.get("last_crawled_at"),
            },
        )
        conn.commit()
