from __future__ import annotations
"""파서 베이스 클래스 + 공통 HTML 유틸리티"""

import sqlite3
from abc import ABC, abstractmethod
from typing import Any

from bs4 import BeautifulSoup, Tag


class BaseParser(ABC):
    """모든 파서의 베이스 클래스."""

    @abstractmethod
    def parse_list(self, html: str) -> list[dict]:
        """목록 페이지를 파싱해 {id, name} 딕셔너리 리스트 반환."""
        ...

    @abstractmethod
    def parse_detail(self, html: str, entity_id: int) -> dict:
        """상세 페이지를 파싱해 DB 저장용 딕셔너리 반환."""
        ...

    @abstractmethod
    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        """데이터를 DB에 upsert."""
        ...

    # ------------------------------------------------------------------
    # 공통 HTML 파싱 유틸리티
    # ------------------------------------------------------------------

    @staticmethod
    def make_soup(html: str) -> BeautifulSoup:
        return BeautifulSoup(html, "lxml")

    @staticmethod
    def text(tag: Tag | None) -> str:
        """태그에서 공백 제거 후 텍스트 반환. None이면 빈 문자열."""
        if tag is None:
            return ""
        return tag.get_text(strip=True)

    @staticmethod
    def find_content_links(soup: BeautifulSoup) -> list[dict]:
        """
        mapledb.kr의 a.search-page-add-content-box 링크에서 엔티티 목록 추출.
        반환: [{"id": int, "name": str}, ...]
        """
        import re
        results: list[dict] = []
        links = soup.find_all("a", class_=lambda c: c and "search-page-add-content-box" in (c if isinstance(c, str) else " ".join(c)))
        for a in links:
            href = a.get("href", "")
            m = re.search(r"q=(\d+)", str(href))
            if not m:
                continue
            entity_id = int(m.group(1))
            # 이름: search-page-add-content-box-main div
            name_div = a.find("div", class_=lambda c: c and "search-page-add-content-box-main" in (c if isinstance(c, str) else " ".join(c)))
            name = name_div.get_text(strip=True) if name_div else ""
            if entity_id and name:
                results.append({"id": entity_id, "name": name})
        return results

    @staticmethod
    def find_table_rows(soup: BeautifulSoup, table_index: int = 0) -> list[Tag]:
        """soup에서 n번째 <table>의 <tr> 목록 반환 (thead 제외)."""
        tables = soup.find_all("table")
        if not tables or table_index >= len(tables):
            return []
        table = tables[table_index]
        rows = table.find_all("tr")
        # 첫 번째 행이 헤더면 제거
        if rows and rows[0].find("th"):
            rows = rows[1:]
        return rows

    @staticmethod
    def parse_info_table(soup: BeautifulSoup) -> dict[str, str]:
        """
        레이블(th/td) → 값(td) 형태의 정보 테이블을 딕셔너리로 변환.
        한국어 게임 DB 사이트의 상세 페이지에 자주 쓰이는 패턴을 처리.
        """
        result: dict[str, str] = {}
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            for row in rows:
                cells = row.find_all(["th", "td"])
                # th-td 쌍 처리
                for i in range(0, len(cells) - 1, 2):
                    key = cells[i].get_text(strip=True)
                    val = cells[i + 1].get_text(strip=True) if i + 1 < len(cells) else ""
                    if key:
                        result[key] = val
                # th만 있고 다음 행에 td가 있는 구조도 처리
                if len(cells) == 1:
                    key = cells[0].get_text(strip=True)
                    # 다음 형제 tr의 첫 td 확인 – 호출자가 직접 처리하도록 여기서는 skip
                    _ = key
        return result

    @staticmethod
    def extract_id_from_link(tag: Tag | None, param: str = "id") -> int | None:
        """
        <a href="...?id=123"> 형태에서 정수 ID 추출.
        param 이름은 'id', 'no', 'idx' 등 사이트마다 다를 수 있음.
        """
        if tag is None:
            return None
        href = tag.get("href", "")
        for part in str(href).split("&"):
            if part.startswith(f"{param}=") or f"?{param}=" in part:
                raw = part.split("=")[-1]
                try:
                    return int(raw)
                except ValueError:
                    pass
        return None

    @staticmethod
    def safe_int(value: Any, default: int = 0) -> int:
        """숫자 변환 실패시 default 반환."""
        try:
            cleaned = str(value).replace(",", "").strip()
            return int(cleaned)
        except (ValueError, TypeError):
            return default

    @staticmethod
    def safe_float(value: Any, default: float = 0.0) -> float:
        try:
            cleaned = str(value).replace(",", "").replace("%", "").strip()
            return float(cleaned)
        except (ValueError, TypeError):
            return default
