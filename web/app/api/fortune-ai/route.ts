import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 프론트엔드 → FastAPI 프록시.
 * 운세 생성(Gemini AI), 캐시, Rate Limiting 모두 FastAPI에서 처리.
 */

const API_INTERNAL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const res = await fetch(`${API_INTERNAL}/api/fortune`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": clientIp,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || "오류가 발생했습니다." },
        { status: res.status },
      );
    }

    const response = NextResponse.json(data);
    if (!data.cached) {
      response.cookies.set("fortune_last_request", String(Date.now()), {
        maxAge: 60,
        path: "/",
      });
    }
    return response;
  } catch {
    return NextResponse.json(
      { error: "서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 },
    );
  }
}
