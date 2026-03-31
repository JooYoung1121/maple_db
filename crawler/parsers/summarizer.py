"""Gemini API를 사용한 게시글 요약 모듈"""
from __future__ import annotations

import asyncio
import os

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

PROMPT_TEMPLATE = """너는 메이플랜드(게임) 소식을 전해주는 친근한 요약봇이야.
아래 공식 공지사항을 읽고, 유저 입장에서 핵심만 쏙쏙 뽑아서 편하게 정리해 줘.

말투 규칙:
- 반말(~임, ~됨, ~함) 또는 가벼운 해요체 OK. 격식체/존댓말 금지
- 유저가 궁금해할 내용 위주로 3~6줄 불릿(- )으로 정리
- 날짜·기간·조건 같은 핵심 숫자는 꼭 포함
- 한 줄은 짧고 임팩트 있게. 장문 금지
- 이모지 사용 금지
- 인사말/맺음말/부연설명 넣지 말 것

예시 톤:
- 경험치 2배 이벤트 옴. 3/28 ~ 4/3 일주일간
- 자유시장 버그 수정됨. 이제 거래 정상 작동
- 신규 퀘스트 3개 추가. 30렙 이상부터 가능

제목: {title}

본문:
{content}
"""


async def summarize_post(title: str, content: str) -> str | None:
    """Gemini로 게시글을 요약한다. API 키가 없거나 실패 시 None 반환."""
    if not GOOGLE_API_KEY:
        return None
    if not content or len(content.strip()) < 50:
        return None

    try:
        import google.generativeai as genai

        def _sync_generate() -> str | None:
            genai.configure(api_key=GOOGLE_API_KEY)
            model = genai.GenerativeModel("gemini-2.5-flash-lite")
            truncated = content[:8000] if len(content) > 8000 else content
            prompt = PROMPT_TEMPLATE.format(title=title, content=truncated)
            response = model.generate_content(prompt)
            return response.text.strip() if response.text else None

        return await asyncio.to_thread(_sync_generate)
    except Exception as e:
        print(f"[summarizer] 요약 실패: {e}")
        return None
