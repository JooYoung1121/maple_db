import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ── 타입 ─────────────────────────────────────────────── */

interface FortuneRequest {
  birthdate: string; // YYYY-MM-DD
  job: string; // 전사 | 궁수 | 마법사 | 도적
}

interface FortuneResult {
  maple_fortune: string;
  real_fortune: string;
  lucky_monster: string;
  lucky_map: string;
  lucky_item: string;
  enhance_luck: number;
}

/* ── 띠 & 별자리 계산 ─────────────────────────────────── */

const ZODIAC_ANIMALS = [
  "원숭이", "닭", "개", "돼지", "쥐", "소",
  "호랑이", "토끼", "용", "뱀", "말", "양",
] as const;

const CONSTELLATIONS: [string, number, number][] = [
  ["물병자리", 1, 20], ["물고기자리", 2, 19], ["양자리", 3, 21],
  ["황소자리", 4, 20], ["쌍둥이자리", 5, 21], ["게자리", 6, 22],
  ["사자자리", 7, 23], ["처녀자리", 8, 23], ["천칭자리", 9, 23],
  ["전갈자리", 10, 23], ["사수자리", 11, 22], ["염소자리", 12, 22],
];

function getZodiac(year: number): string {
  return ZODIAC_ANIMALS[year % 12];
}

function getConstellation(month: number, day: number): string {
  for (let i = 0; i < CONSTELLATIONS.length; i++) {
    const [name, m, startDay] = CONSTELLATIONS[i];
    const nextIdx = (i + 1) % CONSTELLATIONS.length;
    const [nextName] = CONSTELLATIONS[nextIdx];
    if (month === m && day >= startDay) return nextName;
    if (month === m && day < startDay) return name;
  }
  return "염소자리";
}

/* ── KST 날짜 ─────────────────────────────────────────── */

function getKSTDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/* ── 내부 API 호출 (FastAPI) ──────────────────────────── */

const API_INTERNAL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

async function callFastAPI(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${API_INTERNAL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

/* ── Claude AI 호출 ───────────────────────────────────── */

function buildPrompt(
  zodiac: string,
  constellation: string,
  job: string,
  dateStr: string,
): string {
  return `당신은 메이플스토리 v62(빅뱅 이전, 메이플랜드) 세계관에 정통한 점술사입니다.

오늘 날짜: ${dateStr}
사용자 정보: ${zodiac}띠, ${constellation}, 직업: ${job}

아래 JSON 형식으로 오늘의 운세를 생성해주세요. 반드시 유효한 JSON만 출력하세요.

{
  "maple_fortune": "메이플랜드 세계관 운세 (3~4문장. ${job} 직업 특성 반영. 사냥, 강화, 파티퀘스트, 보스 등 게임 콘텐츠 언급. 구체적이고 재미있게)",
  "real_fortune": "현실 운세 (3~4문장. ${constellation}의 오늘 운세. 금전/연애/건강/직장 중 2~3가지 언급. 따뜻하고 긍정적으로)",
  "lucky_monster": "행운의 몬스터 이름 (메이플랜드 v62에 실제 존재하는 몬스터. 예: 주니어 발록, 크로노스, 머쉬맘, 좀비머쉬룸, 이끼달팽이, 타이머, 블러드하프, 레드 드레이크, 와일드보어, 루이넬 등)",
  "lucky_map": "행운의 사냥터 이름 (메이플랜드 v62에 실제 존재하는 맵. 예: 개미굴 깊은 곳, 루디브리엄 시계탑, 죽은 나무의 숲, 엘나스 산간지역, 지구방위본부 등)",
  "lucky_item": "행운의 아이템 이름 (메이플랜드 v62에 실제 존재하는 아이템. 장비/소비/기타 모두 가능. 예: 청룡언월도, 반 레온 모자, 장갑 공격력 주문서 60%, 엘릭서, 10% 주문서 등)",
  "enhance_luck": (1~5 사이 정수. 오늘의 강화 운. 1=매우나쁨, 5=대박)
}

중요:
- 코드블록(\`\`\`) 없이 순수 JSON만 출력
- ${zodiac}띠와 ${constellation}의 특성을 운세에 자연스럽게 녹여주세요
- 메이플 운세는 ${job} 직업의 실제 플레이 스타일을 반영하세요
- 모든 몬스터/맵/아이템은 메이플스토리 v62(빅뱅 이전)에 실제로 존재하는 것이어야 합니다`;
}

async function queryClaudeAI(
  zodiac: string,
  constellation: string,
  job: string,
  dateStr: string,
): Promise<FortuneResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 미설정");

  const prompt = buildPrompt(zodiac, constellation, job, dateStr);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Claude API 오류: ${res.status}`);
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  // JSON 파싱 (코드블록 감싸져 있을 수도 있으므로 정리)
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned) as FortuneResult;
  return parsed;
}

/* ── POST 핸들러 ──────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const body: FortuneRequest = await request.json();
    const { birthdate, job } = body;

    if (!birthdate || !job) {
      return NextResponse.json(
        { error: "생년월일과 직업을 입력해주세요." },
        { status: 400 },
      );
    }

    const [yearStr, monthStr, dayStr] = birthdate.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    const zodiac = getZodiac(year);
    const constellation = getConstellation(month, day);
    const dateStr = getKSTDate();

    // 1. Rate Limit 체크 (FastAPI → IP 기반)
    const rateRes = await callFastAPI("/api/fortune/rate-check", {
      method: "POST",
      headers: {
        "x-forwarded-for":
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
      },
    });
    if (rateRes.status === 429) {
      const err = await rateRes.json();
      return NextResponse.json(
        { error: err.detail },
        {
          status: 429,
          headers: { "Retry-After": rateRes.headers.get("retry-after") || "30" },
        },
      );
    }
    const rateData = await rateRes.json();

    // 2. 캐시 확인
    const cacheParams = new URLSearchParams({
      date: dateStr,
      zodiac,
      constellation,
      job,
    });
    const cacheRes = await callFastAPI(`/api/fortune/cache?${cacheParams}`);
    const cacheData = await cacheRes.json();

    if (cacheData.count >= 3) {
      // 이미 3개 → 랜덤 반환 (AI 호출 안 함)
      const cached =
        cacheData.results[Math.floor(Math.random() * cacheData.results.length)];
      return NextResponse.json({
        ...cached,
        zodiac,
        constellation,
        job,
        cached: true,
        remaining: rateData.remaining,
      });
    }

    // 3. Claude API 호출
    const fortune = await queryClaudeAI(zodiac, constellation, job, dateStr);

    // 4. 캐시 저장
    await callFastAPI("/api/fortune/cache", {
      method: "POST",
      body: JSON.stringify({
        cache_date: dateStr,
        zodiac,
        constellation,
        job,
        ...fortune,
      }),
    });

    // 5. 쿠키 설정 + 응답
    const response = NextResponse.json({
      ...fortune,
      zodiac,
      constellation,
      job,
      cached: false,
      remaining: rateData.remaining,
    });
    response.cookies.set("fortune_last_request", String(Date.now()), {
      maxAge: 60,
      path: "/",
    });
    return response;
  } catch (e) {
    const message =
      e instanceof SyntaxError
        ? "AI 응답을 파싱하지 못했습니다. 다시 시도해주세요."
        : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
