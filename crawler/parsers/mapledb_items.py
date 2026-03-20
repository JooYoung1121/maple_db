from __future__ import annotations
"""mapledb.kr 아이템 파서"""

import json
import sqlite3
from datetime import datetime, timezone

from .base import BaseParser


class ItemParser(BaseParser):
    """
    목록: /item.php  (HTML table)
    상세: /search.php?q={id}&t=i
    """

    # 한국어 스탯 레이블 → 영문 키 매핑
    _STAT_LABELS: dict[str, str] = {
        "STR": "str", "DEX": "dex", "INT": "int", "LUK": "luk",
        "힘": "str", "민첩": "dex", "지능": "int", "운": "luk",
        "최대HP": "max_hp", "최대MP": "max_mp",
        "공격력": "attack", "마력": "magic_attack",
        "방어력": "defense", "이동속도": "speed", "점프력": "jump",
    }

    def parse_list(self, html: str) -> list[dict]:
        soup = self.make_soup(html)
        # mapledb.kr 링크 기반 목록 시도
        results = self.find_content_links(soup)
        if results:
            return results
        # 폴백: 테이블 기반
        rows = self.find_table_rows(soup, table_index=0)
        for row in rows:
            try:
                cells = row.find_all("td")
                if len(cells) < 2:
                    continue
                link = row.find("a")
                entity_id = self.extract_id_from_link(link, "id") or \
                            self.extract_id_from_link(link, "no") or \
                            self.extract_id_from_link(link, "idx")
                if entity_id is None:
                    entity_id = self.safe_int(self.text(cells[0]), 0) or None
                if entity_id is None:
                    continue
                name = self.text(link) if link else self.text(cells[1])
                if not name:
                    name = self.text(cells[1])
                results.append({"id": entity_id, "name": name})
            except Exception:
                continue
        return results

    def parse_detail(self, html: str, entity_id: int) -> dict:
        soup = self.make_soup(html)
        data: dict = {"id": entity_id}

        try:
            # 이름: h1, h2, .item-name, 또는 테이블에서 추출
            name_tag = soup.find("h1") or soup.find("h2") or soup.find(class_="item-name")
            data["name"] = self.text(name_tag) if name_tag else ""

            info = self.parse_info_table(soup)

            data["category"] = info.get("분류", info.get("카테고리", ""))
            data["subcategory"] = info.get("세부분류", info.get("종류", ""))
            data["level_req"] = self.safe_int(info.get("레벨", info.get("착용레벨", "0")))
            data["job_req"] = info.get("직업", info.get("착용직업", ""))
            data["description"] = info.get("설명", info.get("아이템 설명", ""))

            # 아이콘
            icon_img = soup.find("img", class_="item-icon") or \
                       soup.find("img", alt=lambda a: a and "아이콘" in a)
            if icon_img is None:
                # fallback: 첫 번째 작은 이미지
                for img in soup.find_all("img"):
                    src = img.get("src", "")
                    if "icon" in src.lower() or "item" in src.lower():
                        icon_img = img
                        break
            data["icon_url"] = icon_img.get("src", "") if icon_img else ""

            # 스탯 파싱
            stats: dict[str, int] = {}
            for label, key in self._STAT_LABELS.items():
                if label in info:
                    val = self.safe_int(info[label])
                    if val != 0:
                        stats[key] = val
            data["stats"] = json.dumps(stats, ensure_ascii=False) if stats else None

        except Exception:
            pass

        data["last_crawled_at"] = datetime.now(timezone.utc).isoformat()
        return data

    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            """
            INSERT OR REPLACE INTO items
                (id, name, category, subcategory, level_req, job_req,
                 stats, description, icon_url, source_url, last_crawled_at)
            VALUES
                (:id, :name, :category, :subcategory, :level_req, :job_req,
                 :stats, :description, :icon_url, :source_url, :last_crawled_at)
            """,
            {
                "id": data.get("id"),
                "name": data.get("name", ""),
                "category": data.get("category"),
                "subcategory": data.get("subcategory"),
                "level_req": data.get("level_req", 0),
                "job_req": data.get("job_req"),
                "stats": data.get("stats"),
                "description": data.get("description"),
                "icon_url": data.get("icon_url"),
                "source_url": data.get("source_url"),
                "last_crawled_at": data.get("last_crawled_at"),
            },
        )
        conn.commit()
