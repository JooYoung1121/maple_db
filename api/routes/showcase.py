"""캐릭터 자랑 갤러리 — Discord 채널에서 이미지를 가져옵니다"""
from fastapi import APIRouter, Query

from api.discord_bot import get_bot

router = APIRouter()


@router.get("/api/showcase")
async def get_showcase_images(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
):
    """Discord #코디자랑 채널의 이미지를 페이지네이션으로 반환"""
    bot = get_bot()
    if not bot or not bot.is_ready():
        return {"images": [], "total": 0, "page": page, "per_page": per_page}

    # 최대 200개 메시지에서 이미지 수집
    all_images = await bot.fetch_showcase_images(limit=200)

    # 페이지네이션
    total = len(all_images)
    start = (page - 1) * per_page
    end = start + per_page
    images = all_images[start:end]

    return {
        "images": images,
        "total": total,
        "page": page,
        "per_page": per_page,
    }
