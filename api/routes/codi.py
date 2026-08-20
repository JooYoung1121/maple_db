"""코디 시뮬레이터 — 파트(헤어/성형/장비) 검색

헤어·성형은 게임 데이터 전체(코디 미리보기 용도라 메랜 레퍼런스 필터 미적용),
장비는 메랜 레퍼런스 필터 적용(실제 획득 가능한 것만).
"""
from fastapi import APIRouter, Query, HTTPException

from crawler.db import get_connection
from api.routes.mapleland_reference import id_filter_sql

router = APIRouter()

# type → (category, subcategory 목록, 레퍼런스 필터 적용 여부)
# 코디는 "외형 미리보기" 도구라 레퍼런스 필터를 걸지 않는다 — 캐시샵 코디(목욕가운 등)가
# 레퍼런스(드랍/제작 장비 목록)에 없어서 걸러지던 문제 수정 (2026-07-24)
PART_TYPES: dict[str, tuple[str, tuple[str, ...], bool]] = {
    "hair": ("Character", ("Hair",), False),
    "face": ("Character", ("Face",), False),
    "hat": ("Armor", ("Hat",), False),
    "faceAcc": ("Accessory", ("Face Accessory",), False),
    "eyeDec": ("Accessory", ("Eye Decoration",), False),
    "earring": ("Accessory", ("Earrings",), False),
    "overall": ("Armor", ("Overall",), False),
    "top": ("Armor", ("Top",), False),
    "bottom": ("Armor", ("Bottom",), False),
    "shoes": ("Armor", ("Shoes",), False),
    "glove": ("Armor", ("Glove",), False),
    "cape": ("Armor", ("Cape",), False),
    "shield": ("Armor", ("Shield",), False),
    "weapon": ("WEAPON", (), False),  # 특수 처리: 한손+두손 무기
}


@router.get("/codi/parts")
def codi_parts(
    type: str = Query(...),
    q: str | None = Query(default=None, max_length=50),
    gender: str | None = Query(default=None, pattern="^[mf]$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=60, ge=1, le=120),
):
    if type not in PART_TYPES:
        raise HTTPException(status_code=400, detail=f"type은 {', '.join(PART_TYPES)} 중 하나")
    category, subs, use_ref = PART_TYPES[type]

    conditions = ["i.icon_url IS NOT NULL"]
    params: list = []
    if gender:
        # WZ에 성별 컬럼이 없어 ID 규칙으로 판별 (현 DB의 GMS v92+KMS 데이터로 검증)
        if type == "hair":
            # 헤어 천단위 블록: 30·33=남 / 31·32·34·35=여 (토벤=30, 깜찍이=31, 프린스컷=33, 팜트리=34)
            blocks = (30, 33) if gender == "m" else (31, 32, 34, 35)
            conditions.append(f"(i.id/1000) IN ({','.join(map(str, blocks))})")
        elif type == "face":
            # 성형: 20xxx=남 / 21xxx=여
            conditions.append("(i.id/1000) = ?")
            params.append(20 if gender == "m" else 21)
        elif category != "WEAPON":
            # 방어구: (id/1000)%10 → 0=남성용, 1=여성용, 그 외(2·3 등)=공용 (도로스=1050·남 / 도로네스=1051·여)
            # 반대 성별 전용만 제외해 공용은 양쪽 모두 노출.
            # 무기는 성별 전용이 없고 캐시 무기(17xxxxx)가 이 규칙과 어긋나므로(예: 1701000) 필터 미적용
            conditions.append("(i.id/1000) % 10 != ?")
            params.append(1 if gender == "m" else 0)
    if category == "WEAPON":
        conditions.append("i.category IN ('One-Handed Weapon', 'Two-Handed Weapon')")
    else:
        conditions.append("i.category = ?")
        params.append(category)
        if subs:
            ph = ",".join("?" for _ in subs)
            conditions.append(f"i.subcategory IN ({ph})")
            params.extend(subs)
    if use_ref:
        flt = id_filter_sql("i.id", "items")
        if flt:
            conditions.append(flt)
    if q and q.strip():
        conditions.append(
            "(i.name LIKE ? OR i.id IN (SELECT entity_id FROM entity_names_en"
            " WHERE entity_type='item' AND name_en LIKE ?))"
        )
        like = f"%{q.strip()}%"
        params.extend([like, like])

    where = "WHERE " + " AND ".join(conditions)
    offset = (page - 1) * per_page

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        total = conn.execute(f"SELECT COUNT(*) FROM items i {where}", params).fetchone()[0]
        rows = conn.execute(
            f"""SELECT i.id, i.name, i.icon_url, i.level_req,
                       (SELECT name_en FROM entity_names_en
                        WHERE entity_type='item' AND entity_id=i.id AND source='kms') AS name_kr
                FROM items i {where}
                ORDER BY COALESCE(
                    (SELECT name_en FROM entity_names_en
                     WHERE entity_type='item' AND entity_id=i.id AND source='kms'), i.name), i.id
                LIMIT ? OFFSET ?""",
            params + [per_page, offset],
        ).fetchall()
        parts = [
            {
                "id": r["id"],
                "name": (r["name_kr"] or r["name"] or "").strip(),
                "icon": r["icon_url"],
                "level": r["level_req"] or 0,
            }
            for r in rows
        ]
    finally:
        conn.close()
    return {"parts": parts, "total": total, "page": page, "per_page": per_page}


# ── 코디 자랑 갤러리 ──
import json as _json
import os as _os

from fastapi import Request
from pydantic import BaseModel

_ADMIN_PW = _os.environ.get("GAME_ADMIN_PASSWORD", "")
_MAX_OUTFIT_ITEMS = 14


class CodiPostCreate(BaseModel):
    nickname: str
    title: str
    outfit: dict  # { skin: number, <slot>: {id, name} }


@router.get("/codi/posts")
def list_codi_posts(
    sort: str = Query(default="latest", pattern="^(latest|likes)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=24, ge=1, le=60),
):
    try:
        conn = get_connection()
    except Exception:
        return {"posts": [], "total": 0}
    try:
        order = "likes DESC, id DESC" if sort == "likes" else "id DESC"
        total = conn.execute("SELECT COUNT(*) FROM codi_posts").fetchone()[0]
        rows = conn.execute(
            f"SELECT id, nickname, title, outfit_json, likes, created_at FROM codi_posts"
            f" ORDER BY {order} LIMIT ? OFFSET ?",
            (per_page, (page - 1) * per_page),
        ).fetchall()
        posts = []
        for r in rows:
            d = dict(r)
            try:
                d["outfit"] = _json.loads(d.pop("outfit_json"))
            except Exception:
                continue
            posts.append(d)
    except Exception:
        return {"posts": [], "total": 0}  # 테이블 미생성(구버전 볼륨) 허용
    finally:
        conn.close()
    return {"posts": posts, "total": total, "page": page, "per_page": per_page}


@router.post("/codi/posts")
def create_codi_post(body: CodiPostCreate):
    nickname = body.nickname.strip()[:12]
    title = body.title.strip()[:40]
    if not nickname:
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    if not title:
        raise HTTPException(status_code=400, detail="코디 이름을 입력하세요.")
    outfit = body.outfit or {}
    skin = outfit.get("skin")
    if not isinstance(skin, int) or not (2000 <= skin <= 2015):
        raise HTTPException(status_code=400, detail="잘못된 코디 데이터입니다.")
    # 슬롯 정제: 알려진 키만, {id:int, name:str}만 보존
    clean: dict = {"skin": skin}
    slot_keys = ("hair", "face", "hat", "overall", "top", "bottom", "shoes", "glove", "cape", "shield", "weapon")
    worn = 0
    for k in slot_keys:
        v = outfit.get(k)
        if isinstance(v, dict) and isinstance(v.get("id"), int) and v["id"] > 0:
            clean[k] = {"id": v["id"], "name": str(v.get("name") or "")[:60]}
            worn += 1
    # 펫 (최대 3마리, 펫 아이템 ID 대역만)
    pets = outfit.get("pets")
    if isinstance(pets, list):
        clean_pets = [p for p in pets if isinstance(p, int) and 5000000 <= p < 5001000][:3]
        if clean_pets:
            clean["pets"] = clean_pets
    if worn == 0:
        raise HTTPException(status_code=400, detail="한 가지 이상 착용한 코디만 등록할 수 있습니다.")
    if worn > _MAX_OUTFIT_ITEMS:
        raise HTTPException(status_code=400, detail="코디 데이터가 너무 큽니다.")

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        cur = conn.execute(
            "INSERT INTO codi_posts (nickname, title, outfit_json) VALUES (?, ?, ?)",
            (nickname, title, _json.dumps(clean, ensure_ascii=False)),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.post("/codi/posts/{post_id}/like")
def like_codi_post(post_id: int, request: Request):
    voter_ip = request.client.host if request.client else "unknown"
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        if not conn.execute("SELECT id FROM codi_posts WHERE id = ?", (post_id,)).fetchone():
            raise HTTPException(status_code=404, detail="코디를 찾을 수 없습니다.")
        if conn.execute(
            "SELECT id FROM codi_post_votes WHERE post_id = ? AND voter_ip = ?", (post_id, voter_ip)
        ).fetchone():
            raise HTTPException(status_code=409, detail="이미 좋아요를 눌렀습니다.")
        conn.execute("INSERT INTO codi_post_votes (post_id, voter_ip) VALUES (?, ?)", (post_id, voter_ip))
        conn.execute("UPDATE codi_posts SET likes = likes + 1 WHERE id = ?", (post_id,))
        conn.commit()
        n = conn.execute("SELECT likes FROM codi_posts WHERE id = ?", (post_id,)).fetchone()[0]
        return {"id": post_id, "likes": n}
    finally:
        conn.close()


@router.delete("/codi/posts/{post_id}")
def delete_codi_post(post_id: int, request: Request):
    if request.headers.get("X-Admin-Password") != _ADMIN_PW:
        raise HTTPException(status_code=403, detail="관리자 인증 실패")
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        conn.execute("DELETE FROM codi_post_votes WHERE post_id = ?", (post_id,))
        cur = conn.execute("DELETE FROM codi_posts WHERE id = ?", (post_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="코디를 찾을 수 없습니다.")
        return {"deleted": post_id}
    finally:
        conn.close()
