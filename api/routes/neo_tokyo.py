"""네오도쿄 출시 정보 — 공식·현장 제보·원작 참고를 구분한다."""
from fastapi import APIRouter
from crawler.catalog_data import neo_tokyo

router = APIRouter()


@router.get("/neo-tokyo")
def get_neo_tokyo():
    return neo_tokyo()
