"""mapledb.kr 퀘스트 파서"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone

from .base import BaseParser


class QuestParser(BaseParser):
    """
    목록: /quest.php
    상세: /search.php?q={id}&t=q
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
            name_tag = soup.find("h1") or soup.find("h2") or soup.find(class_="quest-name")
            data["name"] = self.text(name_tag) if name_tag else ""

            info = self.parse_info_table(soup)

            data["level_req"] = self.safe_int(info.get("레벨", info.get("최소레벨", info.get("권장레벨", "0"))))
            data["npc_start"] = info.get("시작 NPC", info.get("시작NPC", info.get("의뢰인", "")))
            data["npc_end"] = info.get("완료 NPC", info.get("완료NPC", info.get("완료", "")))
            data["description"] = info.get("설명", info.get("퀘스트 설명", ""))

            # 보상 파싱: 보상 섹션 테이블 찾기
            rewards = self._parse_rewards(soup, info)
            data["rewards"] = json.dumps(rewards, ensure_ascii=False) if rewards else None

        except Exception:
            pass

        data["last_crawled_at"] = datetime.now(timezone.utc).isoformat()
        return data

    def _parse_rewards(self, soup, info: dict) -> dict:
        rewards: dict = {}

        # 정보 테이블에서 보상 관련 키 추출
        for key, val in info.items():
            if any(kw in key for kw in ("보상", "경험치", "메소", "EXP", "Meso")):
                rewards[key] = val

        # 보상 전용 테이블 탐색
        for table in soup.find_all("table"):
            headers = [self.text(th) for th in table.find_all("th")]
            header_text = " ".join(headers)
            if not any(kw in header_text for kw in ("보상", "리워드", "Reward")):
                continue
            items: list[dict] = []
            for row in table.find_all("tr"):
                cells = row.find_all("td")
                if not cells:
                    continue
                try:
                    link = row.find("a")
                    item_id = self.extract_id_from_link(link, "id")
                    item_name = self.text(link) if link else self.text(cells[0])
                    qty_text = self.text(cells[-1]) if len(cells) > 1 else "1"
                    qty = self.safe_int(qty_text, 1)
                    entry: dict = {"name": item_name, "qty": qty}
                    if item_id:
                        entry["id"] = item_id
                    items.append(entry)
                except Exception:
                    continue
            if items:
                rewards["items"] = items

        return rewards

    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            """
            INSERT OR REPLACE INTO quests
                (id, name, level_req, npc_start, npc_end, rewards, description,
                 source_url, last_crawled_at)
            VALUES
                (:id, :name, :level_req, :npc_start, :npc_end, :rewards, :description,
                 :source_url, :last_crawled_at)
            """,
            {
                "id": data.get("id"),
                "name": data.get("name", ""),
                "level_req": data.get("level_req", 0),
                "npc_start": data.get("npc_start"),
                "npc_end": data.get("npc_end"),
                "rewards": data.get("rewards"),
                "description": data.get("description"),
                "source_url": data.get("source_url"),
                "last_crawled_at": data.get("last_crawled_at"),
            },
        )
        conn.commit()
