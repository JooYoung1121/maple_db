"""한글 HWP 5.x(.hwp/.hwpx 바이너리 OLE) → 표 뷰 JSON + HTML 변환.

엑셀(excel_render)과 동일한 출력 형식({sheets:[{name,ncols,rows}]}, html)을 만들어
정보공유 게시판의 2-뷰 파이프라인을 그대로 재사용한다.

HWP5 표 구조: BodyText/SectionN 레코드 스트림에서
  - HWPTAG_TABLE(73): 표 시작
  - HWPTAG_LIST_HEADER(72): 셀 — 오프셋 8/10/12/14 = 열/행/열병합/행병합
  - HWPTAG_PARA_TEXT(67): 셀 안 문단 텍스트(UTF-16LE, 제어문자 처리)
색상/테두리는 borderFill 참조라 복원이 복잡해 미지원(구조·텍스트·병합만 보존).
"""
from __future__ import annotations

import html
import io
import struct
import zlib
from typing import Optional

# UTF-16 본문에서 8워드(16바이트) 차지하는 인라인/확장 제어문자
_CTRL8 = {1, 2, 3, 4, 5, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23}

HWPTAG_PARA_TEXT = 67
HWPTAG_LIST_HEADER = 72
HWPTAG_TABLE = 73

MAX_ROWS = 4000
MAX_COLS = 60


def is_hwp(data: bytes) -> bool:
    """OLE2 매직(=바이너리 HWP 5.x)."""
    return data[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def _para_text(d: bytes) -> str:
    out = []
    i, n = 0, len(d)
    while i + 1 < n:
        c = d[i] | (d[i + 1] << 8)
        if c in _CTRL8:
            i += 16
            continue
        if c in (10, 13):
            out.append("\n")
            i += 2
            continue
        if c < 32:
            i += 2
            continue
        out.append(chr(c))
        i += 2
    return "".join(out).strip()


def _iter_records(d: bytes):
    i, n = 0, len(d)
    while i + 4 <= n:
        h = struct.unpack_from("<I", d, i)[0]
        i += 4
        tag = h & 0x3FF
        size = (h >> 20) & 0xFFF
        if size == 0xFFF:
            size = struct.unpack_from("<I", d, i)[0]
            i += 4
        body = d[i:i + size]
        i += size
        yield tag, body


def _parse_tables(section: bytes):
    """섹션 레코드 스트림에서 표 목록 추출. 각 표 = [{col,row,cspan,rspan,text}]."""
    tables = []
    cur_table: Optional[list] = None
    cur_cell: Optional[dict] = None
    for tag, body in _iter_records(section):
        if tag == HWPTAG_TABLE:
            cur_table = []
            tables.append(cur_table)
            cur_cell = None
        elif tag == HWPTAG_LIST_HEADER and cur_table is not None and len(body) >= 16:
            col, row, cspan, rspan = struct.unpack_from("<HHHH", body, 8)
            if 1 <= cspan <= MAX_COLS and 1 <= rspan <= MAX_ROWS and col < MAX_COLS and row < MAX_ROWS:
                cur_cell = {"col": col, "row": row, "cspan": cspan, "rspan": rspan, "text": ""}
                cur_table.append(cur_cell)
            else:
                cur_cell = None
        elif tag == HWPTAG_PARA_TEXT and cur_cell is not None:
            t = _para_text(body)
            if t:
                cur_cell["text"] = (cur_cell["text"] + "\n" + t) if cur_cell["text"] else t
    return [t for t in tables if t]


def _build_sheet(cells: list, name: str):
    ncols = min(max(c["col"] + c["cspan"] for c in cells), MAX_COLS)
    nrows = min(max(c["row"] + c["rspan"] for c in cells), MAX_ROWS)
    grid = [[None] * ncols for _ in range(nrows)]  # None=빈칸, 'H'=병합가림, dict=셀
    for c in cells:
        r0, c0 = c["row"], c["col"]
        if r0 >= nrows or c0 >= ncols:
            continue
        grid[r0][c0] = {"v": c["text"], "rowspan": c["rspan"], "colspan": c["cspan"]}
        for rr in range(r0, min(r0 + c["rspan"], nrows)):
            for cc in range(c0, min(c0 + c["cspan"], ncols)):
                if (rr, cc) != (r0, c0) and grid[rr][cc] is None:
                    grid[rr][cc] = "H"

    rows, thtml = [], ['<table class="xl">']
    for r in range(nrows):
        row_cells = []
        thtml.append("<tr>")
        for c in range(ncols):
            g = grid[r][c]
            if g == "H":
                row_cells.append({"hidden": True})
                continue
            if g is None:
                cd = {"v": ""}
                rs = cs = 1
            else:
                v = g["v"]; rs = g["rowspan"]; cs = g["colspan"]
                cd = {"v": v}
                if rs > 1:
                    cd["rowspan"] = rs
                if cs > 1:
                    cd["colspan"] = cs
            row_cells.append(cd)
            attrs = ""
            if cd.get("rowspan"):
                attrs += f' rowspan="{cd["rowspan"]}"'
            if cd.get("colspan"):
                attrs += f' colspan="{cd["colspan"]}"'
            safe = html.escape(cd["v"]).replace("\n", "<br>")
            thtml.append(f"<td{attrs}>{safe}</td>")
        thtml.append("</tr>")
        rows.append(row_cells)
    thtml.append("</table>")
    return {"name": name, "ncols": ncols, "rows": rows}, "".join(thtml)


def parse_hwp(data: bytes):
    """returns (excel_json: dict, html: str). excel_render.parse_excel 과 동일한 형식."""
    import olefile

    if not olefile.isOleFile(io.BytesIO(data)):
        raise ValueError("HWP(OLE) 형식이 아닙니다. (HWPX(zip) 형식은 아직 미지원 — 엑셀이나 .hwp 로 올려주세요)")
    ole = olefile.OleFileIO(io.BytesIO(data))
    try:
        hdr = ole.openstream("FileHeader").read()
        compressed = bool(hdr[36] & 1)
        secs = sorted("/".join(s) for s in ole.listdir() if s and s[0] == "BodyText")
        sheets, html_parts = [], []
        for idx, sec in enumerate(secs):
            raw = ole.openstream(sec).read()
            d = zlib.decompress(raw, -15) if compressed else raw
            for ti, cells in enumerate(_parse_tables(d)):
                name = f"표{len(sheets) + 1}"
                sheet, thtml = _build_sheet(cells, name)
                sheets.append(sheet)
                if len(sheets) > 1:
                    html_parts.append(f'<h4 class="xl-sheet">{html.escape(name)}</h4>')
                html_parts.append(thtml)
    finally:
        ole.close()
    if not sheets:
        raise ValueError("HWP 에서 표를 찾지 못했습니다. (표 형태 문서만 변환됩니다)")
    return {"sheets": sheets}, "\n".join(html_parts)
