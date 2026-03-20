"""mapledb.kr 몬스터 파서"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from .base import BaseParser


class MobParser(BaseParser):
    """
    목록: /mob.php
    상세: /search.php?q={id}&t=m
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
            name_tag = soup.find("h1") or soup.find("h2") or soup.find(class_="mob-name")
            data["name"] = self.text(name_tag) if name_tag else ""

            info = self.parse_info_table(soup)

            data["level"] = self.safe_int(info.get("레벨", info.get("Lv", "0")))
            data["hp"] = self.safe_int(info.get("HP", info.get("체력", "0")))
            data["mp"] = self.safe_int(info.get("MP", info.get("마나", "0")))
            data["exp"] = self.safe_int(info.get("경험치", info.get("EXP", "0")))
            data["defense"] = self.safe_int(info.get("방어력", info.get("물리방어력", "0")))
            data["accuracy"] = self.safe_int(info.get("명중률", info.get("명중", "0")))
            data["evasion"] = self.safe_int(info.get("회피율", info.get("회피", "0")))

            boss_text = info.get("보스", info.get("속성", "")).lower()
            data["is_boss"] = 1 if "보스" in boss_text or "boss" in boss_text else 0

            # 아이콘
            icon_img = soup.find("img", class_="mob-icon")
            if icon_img is None:
                for img in soup.find_all("img"):
                    src = img.get("src", "")
                    if "mob" in src.lower() or "monster" in src.lower() or "icon" in src.lower():
                        icon_img = img
                        break
            data["icon_url"] = icon_img.get("src", "") if icon_img else ""

            # 드롭 테이블
            data["drops"] = self._parse_drops(soup, entity_id)

            # 스폰 맵
            data["spawns"] = self._parse_spawns(soup, entity_id)

        except Exception:
            data.setdefault("drops", [])
            data.setdefault("spawns", [])

        data["last_crawled_at"] = datetime.now(timezone.utc).isoformat()
        return data

    def _parse_drops(self, soup, mob_id: int) -> list[dict]:
        """드롭 아이템 테이블 파싱."""
        drops: list[dict] = []
        # 드롭 테이블은 보통 "드롭" 또는 "아이템" 헤더가 있는 섹션 아래
        for table in soup.find_all("table"):
            headers = [self.text(th) for th in table.find_all("th")]
            header_text = " ".join(headers)
            if not any(kw in header_text for kw in ("드롭", "아이템", "획득")):
                continue
            rows = table.find_all("tr")
            for row in rows:
                cells = row.find_all("td")
                if not cells:
                    continue
                try:
                    link = row.find("a")
                    item_id = self.extract_id_from_link(link, "id") or \
                               self.extract_id_from_link(link, "no")
                    if item_id is None:
                        raw = self.text(cells[0])
                        item_id = self.safe_int(raw) or None
                    if item_id is None:
                        continue
                    item_name = self.text(link) if link else (self.text(cells[1]) if len(cells) > 1 else "")
                    rate_text = self.text(cells[-1]) if len(cells) > 1 else ""
                    drop_rate = self.safe_float(rate_text)
                    drops.append({
                        "mob_id": mob_id,
                        "item_id": item_id,
                        "item_name": item_name,
                        "drop_rate": drop_rate,
                    })
                except Exception:
                    continue
        return drops

    def _parse_spawns(self, soup, mob_id: int) -> list[dict]:
        """스폰 맵 테이블 파싱."""
        spawns: list[dict] = []
        for table in soup.find_all("table"):
            headers = [self.text(th) for th in table.find_all("th")]
            header_text = " ".join(headers)
            if not any(kw in header_text for kw in ("스폰", "맵", "지역", "출현")):
                continue
            rows = table.find_all("tr")
            for row in rows:
                cells = row.find_all("td")
                if not cells:
                    continue
                try:
                    link = row.find("a")
                    map_id = self.extract_id_from_link(link, "id") or \
                              self.extract_id_from_link(link, "no")
                    if map_id is None:
                        raw = self.text(cells[0])
                        map_id = self.safe_int(raw) or None
                    if map_id is None:
                        continue
                    map_name = self.text(link) if link else (self.text(cells[1]) if len(cells) > 1 else "")
                    spawns.append({
                        "mob_id": mob_id,
                        "map_id": map_id,
                        "map_name": map_name,
                    })
                except Exception:
                    continue
        return spawns

    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            """
            INSERT OR REPLACE INTO mobs
                (id, name, level, hp, mp, exp, defense, accuracy, evasion,
                 is_boss, icon_url, source_url, last_crawled_at)
            VALUES
                (:id, :name, :level, :hp, :mp, :exp, :defense, :accuracy, :evasion,
                 :is_boss, :icon_url, :source_url, :last_crawled_at)
            """,
            {
                "id": data.get("id"),
                "name": data.get("name", ""),
                "level": data.get("level", 0),
                "hp": data.get("hp", 0),
                "mp": data.get("mp", 0),
                "exp": data.get("exp", 0),
                "defense": data.get("defense", 0),
                "accuracy": data.get("accuracy", 0),
                "evasion": data.get("evasion", 0),
                "is_boss": data.get("is_boss", 0),
                "icon_url": data.get("icon_url"),
                "source_url": data.get("source_url"),
                "last_crawled_at": data.get("last_crawled_at"),
            },
        )

        # 드롭 저장
        for drop in data.get("drops", []):
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO mob_drops (mob_id, item_id, item_name, drop_rate)
                    VALUES (:mob_id, :item_id, :item_name, :drop_rate)
                    """,
                    drop,
                )
            except Exception:
                pass

        # 스폰 저장
        for spawn in data.get("spawns", []):
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO mob_spawns (mob_id, map_id, map_name)
                    VALUES (:mob_id, :map_id, :map_name)
                    """,
                    spawn,
                )
            except Exception:
                pass

        conn.commit()
