"""Gemini API를 사용한 게시글 요약 모듈"""
from __future__ import annotations

import asyncio
import os

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

PROMPT_TEMPLATE = """다음은 메이플랜드(게임) 공식 공지사항입니다.
핵심 내용을 한국어로 간결하게 요약해 주세요.

규칙:
- 3~8줄 이내의 불릿 포인트(- )로 작성
- 기간, 방식, 순서, 핵심 변경사항 위주
- 이모지 사용 금지
- 불필요한 인사말/맺음말 제외

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
