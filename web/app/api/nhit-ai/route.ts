import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface NhitAiRequest {
  jobName: string;
  skillName: string;
  skillDamage: number;
  skillHits: number;
  monsterName: string;
  monsterHp: number;
  monsterLevel: number;
  charLevel: number;
  mainStat: number;
  subStat: number;
  atk: number;
  weaponType: string;
  mcResult: {
    pOneHit: number;
    pTwoHit: number;
    pThreeHit: number;
    pFourPlusHit: number;
    expectedHits: number;
    median: number;
  };
}

async function queryClaudeAI(req: NhitAiRequest): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "ANTHROPIC_API_KEY 미설정";

  const prompt = buildPrompt(req);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return `Claude API 오류: ${res.status}`;
  const data = await res.json();
  return data.content?.[0]?.text ?? "응답 없음";
}

async function queryGeminiAI(req: NhitAiRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "GEMINI_API_KEY 미설정";

  const prompt = buildPrompt(req);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) return `Gemini API 오류: ${res.status}`;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "응답 없음";
}

function buildPrompt(req: NhitAiRequest): string {
  return `메이플랜드(pre-Big Bang 메이플스토리) 엔방컷 분석:

직업: ${req.jobName} | 스킬: ${req.skillName} (${req.skillDamage}% × ${req.skillHits}타)
캐릭터 Lv.${req.charLevel} | 주스탯: ${req.mainStat} | 부스탯: ${req.subStat} | 공격력: ${req.atk} | 무기: ${req.weaponType}
대상: ${req.monsterName} (Lv.${req.monsterLevel} / HP ${req.monsterHp.toLocaleString()})

몬테카를로 시뮬레이션 결과 (10,000회):
- 1방컷: ${(req.mcResult.pOneHit * 100).toFixed(1)}%
- 2방컷: ${(req.mcResult.pTwoHit * 100).toFixed(1)}%
- 3방컷: ${(req.mcResult.pThreeHit * 100).toFixed(1)}%
- 4방+: ${(req.mcResult.pFourPlusHit * 100).toFixed(1)}%
- 기댓값: ${req.mcResult.expectedHits.toFixed(2)}방

이 데이터를 바탕으로 2-3문장으로 간결하게 분석해줘:
1. 현재 스펙으로 이 몬스터 사냥 효율 평가
2. 사냥 효율 높이려면 어떤 스탯을 올려야 하는지`;
}

export async function POST(request: NextRequest) {
  try {
    const body: NhitAiRequest = await request.json();
    const [claudeResult, geminiResult] = await Promise.all([
      queryClaudeAI(body),
      queryGeminiAI(body),
    ]);
    return NextResponse.json({ claude: claudeResult, gemini: geminiResult });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
