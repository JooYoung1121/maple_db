"""maplestory.io 맵 실사 렌더(gms/92 /map/{id}/render) 품질 전수 점검 → web/data/mapRenderStatus.json

배경(2026-10-14): 망각의 길 1~4처럼 렌더 서버가 배경·타일을 그리지 못해 오브젝트(사다리 등)만 있는
거의 투명한 이미지를 HTTP 200으로 돌려주는 맵이 있다. 클라이언트는 onLoad 만 보므로 "로딩은 끝났는데
까만 화면"으로 보였다. 이미지 픽셀을 읽을 수 없는 브라우저 대신 여기서 미리 분류해 정적 목록으로 배포한다.

1단계: 모든 맵에 Range 요청(33바이트)으로 상태·총 바이트·가로세로를 수집 (HEAD 미지원 대비)
2단계: 바이트/픽셀 < SPARSE_SCAN_RATIO 인 후보만 전체 내려받아 불투명 픽셀 비율 계산
       (정상 맵은 0.1 B/px 이상이 대부분이라 후보는 전체의 10% 남짓, 파일도 작다)
출력: {"missing": [404], "sparse": [불투명 < SPARSE_OPAQUE_RATIO], "partial": [불투명 < PARTIAL_OPAQUE_RATIO], ...}
참고: maplestory.io 렌더러는 배경(back) 레이어를 그리지 않아 배경 위주 맵은 오브젝트만 남는다.

실행: uv run --python 3.11 --no-project --with pillow python scripts/audit_map_renders.py [--ids-file FILE]
"""
import argparse
import concurrent.futures
import io
import json
import struct
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from crawler.db import get_connection  # noqa: E402

RENDER = "https://maplestory.io/api/gms/92/map/{id}/render"
UA = {"User-Agent": "mapledb-map-render-audit/1.0"}
SPARSE_SCAN_RATIO = 0.12   # B/px — 이보다 작으면 픽셀 검사 대상
SPARSE_OPAQUE_RATIO = 0.04   # 불투명 픽셀 4% 미만 → "빈 렌더" (미니맵으로 대체)
PARTIAL_OPAQUE_RATIO = 0.12  # 4~12% → "배경 빠진 렌더" (리스항구·싱가포르처럼 오브젝트만 남은 맵, 렌더+미니맵 병행)
OUT = ROOT / "web" / "data" / "mapRenderStatus.json"


def probe(map_id: int):
    req = urllib.request.Request(RENDER.format(id=map_id), headers={**UA, "Range": "bytes=0-32"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            b = r.read(40)
            cr = r.headers.get("Content-Range", "")
            total = int(cr.split("/")[-1]) if "/" in cr else int(r.headers.get("Content-Length") or 0)
            if b[:4] == b"\x89PNG":
                w, h = struct.unpack(">II", b[16:24])
                return map_id, r.status, total, w, h
            return map_id, r.status, total, 0, 0
    except urllib.error.HTTPError as e:
        return map_id, e.code, 0, 0, 0
    except Exception:
        return map_id, 0, 0, 0, 0


def opaque_ratio(map_id: int):
    req = urllib.request.Request(RENDER.format(id=map_id), headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        im = Image.open(io.BytesIO(data)).convert("RGBA")
        alpha = im.getchannel("A")
        hist = alpha.histogram()
        opaque = sum(hist[8:])  # 알파 8 이상 — 안티앨리어싱 가장자리 잡음 제외
        return map_id, opaque / (im.width * im.height), len(data)
    except Exception:
        return map_id, None, 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids-file", help="1단계 결과(id|status|bytes|w|h) 재사용")
    args = ap.parse_args()

    conn = get_connection()
    ids = [r[0] for r in conn.execute("SELECT id FROM maps ORDER BY id")]
    conn.close()

    if args.ids_file:
        probes = []
        for line in Path(args.ids_file).read_text().split("\n"):
            parts = line.split("|")
            if len(parts) >= 5 and parts[0].isdigit():
                probes.append(tuple(int(x) for x in parts[:5]))
    else:
        with concurrent.futures.ThreadPoolExecutor(16) as ex:
            probes = list(ex.map(probe, ids))
    missing = sorted(p[0] for p in probes if p[1] == 404)
    unknown = sorted(p[0] for p in probes if p[1] not in (200, 206, 404))
    candidates = [p[0] for p in probes if p[1] in (200, 206) and p[3] > 0 and p[2] / (p[3] * p[4]) < SPARSE_SCAN_RATIO]
    print(f"maps={len(ids)} missing={len(missing)} unknown={len(unknown)} scan={len(candidates)}", file=sys.stderr)

    sparse, partial, ratios = [], [], {}
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        for map_id, ratio, _ in ex.map(opaque_ratio, candidates):
            if ratio is None:
                continue
            ratios[map_id] = round(ratio, 4)
            if ratio < SPARSE_OPAQUE_RATIO:
                sparse.append(map_id)
            elif ratio < PARTIAL_OPAQUE_RATIO:
                partial.append(map_id)
    sparse.sort()
    partial.sort()
    payload = {
        "_doc": "maplestory.io gms/92 맵 렌더 상태 — scripts/audit_map_renders.py 산출물. missing: 404, sparse: 거의 투명한 빈 렌더(미니맵 대체), partial: 배경 빠진 오브젝트 위주 렌더(미니맵 병행)",
        "audited_at": __import__("datetime").date.today().isoformat(),
        "thresholds": {"scan_bytes_per_px": SPARSE_SCAN_RATIO, "sparse_opaque_ratio": SPARSE_OPAQUE_RATIO, "partial_opaque_ratio": PARTIAL_OPAQUE_RATIO},
        "missing": missing,
        "sparse": sparse,
        "partial": partial,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "data" / "map_render_opaque_ratios.json").write_text(json.dumps(ratios, indent=0) + "\n")
    print(f"sparse={len(sparse)} partial={len(partial)} → {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
