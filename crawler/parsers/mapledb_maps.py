"""mapledb.kr 맵 파서"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from .base import BaseParser


class MapParser(BaseParser):
    """
    목록: /map.php
    상세: /search.php?q={id}&t=a
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
            name_tag = soup.find("h1") or soup.find("h2") or soup.find(class_="map-name")
            data["name"] = self.text(name_tag) if name_tag else ""

            info = self.parse_info_table(soup)

            data["street_name"] = info.get("거리명", info.get("스트리트", info.get("Street", "")))
            data["area"] = info.get("지역", info.get("구역", info.get("Area", "")))

            return_map_raw = info.get("귀환 맵", info.get("귀환맵", info.get("리턴맵", "")))
            data["return_map_id"] = self.safe_int(return_map_raw) or None

        except Exception:
            pass

        data["last_crawled_at"] = datetime.now(timezone.utc).isoformat()
        return data

    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            """
            INSERT OR REPLACE INTO maps
                (id, name, street_name, area, return_map_id, source_url, last_crawled_at)
            VALUES
                (:id, :name, :street_name, :area, :return_map_id, :source_url, :last_crawled_at)
            """,
            {
                "id": data.get("id"),
                "name": data.get("name", ""),
                "street_name": data.get("street_name"),
                "area": data.get("area"),
                "return_map_id": data.get("return_map_id"),
                "source_url": data.get("source_url"),
                "last_crawled_at": data.get("last_crawled_at"),
            },
        )
        conn.commit()
