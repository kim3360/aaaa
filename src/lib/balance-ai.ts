import { categoryLabel } from "./balance"
import { rand } from "./logic"
import type { BalanceCategoryId, BalanceQuestion } from "./types"

const CATEGORY_HINT: Record<BalanceCategoryId, string> = {
  all: "술자리, 연애, 취향, 극단 중에서 매번 다른 결로",
  drink: "술, 안주, 2차, 취중, 해장처럼 술자리 상황",
  love: "연애, 썸, 이상형, 연인 사이 선택",
  taste: "성격, 여행, 음식, 일상 취향",
  extreme: "과장되고 웃긴 극단 선택. 잔인하거나 혐오스럽지는 않게",
}

function clip(text: string, max = 48) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

function oneEmoji(value: string, fallback: string) {
  const chars = Array.from(String(value || "").trim())
  return chars[0] || fallback
}

export function parseBalanceQuestion(raw: unknown, category: BalanceCategoryId): BalanceQuestion | null {
  if (!raw || typeof raw !== "object") return null
  const data = raw as Record<string, unknown>
  const left = clip(String(data.left || ""))
  const right = clip(String(data.right || ""))
  if (!left || !right || left === right) return null
  const picked = category === "all" ? (["drink", "love", "taste", "extreme"] as const)[rand(4)] : category
  return {
    id: `ai-${Date.now()}-${rand(9999)}`,
    category: picked,
    left,
    right,
    leftEmoji: oneEmoji(String(data.leftEmoji || ""), "🟣"),
    rightEmoji: oneEmoji(String(data.rightEmoji || ""), "🩷"),
  }
}

export function buildPrompt(category: BalanceCategoryId, avoid: string[]) {
  const meta = categoryLabel(category)
  const skip = avoid
    .slice(-12)
    .map((line) => `- ${line}`)
    .join("\n")
  return `너는 한국 술자리용 밸런스 게임 출제자다.
카테고리: ${meta.emoji} ${meta.name}
방향: ${CATEGORY_HINT[category]}
이미 나온 문제(절대 비슷하게 내지 말 것):
${skip || "- 없음"}

JSON만 답해.
{"left":"상황까지 들어간 긴 선택지","right":"상황까지 들어간 긴 선택지","leftEmoji":"이모지","rightEmoji":"이모지"}

규칙:
- 한국어, 각 선택지는 한 문장, 28~40자
- 단어 하나 말고 상황·조건이 보이게
- 둘 다 매력 있어서 진짜 고민되게
- 혐오, 성적 노골, 범죄, 자해 금지
- 술자리 친구들 사이에서 웃길 것`
}

function readJsonObject(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```json\s*|```$/g, "")
    .trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start < 0 || end < 0) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

async function fromOpenAI(prompt: string) {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0.95,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "밸런스 게임 문제를 JSON으로만 답한다." },
        { role: "user", content: prompt },
      ],
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return readJsonObject(data.choices?.[0]?.message?.content || "")
}

const GEMINI_MODELS = [process.env.GEMINI_MODEL?.trim(), "gemini-3.6-flash", "gemini-flash-latest", "gemini-3-flash-preview"].filter((name, i, list): name is string => Boolean(name) && list.indexOf(name) === i)

async function fromGemini(prompt: string) {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  if (!key) return { raw: null, error: "GEMINI_API_KEY가 없습니다. .env.local을 확인하고 서버를 재시작하세요" }
  let lastError = "제미나이 응답이 비었습니다"
  for (const model of GEMINI_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.95, responseMimeType: "application/json" },
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string }
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    if (!res.ok) {
      lastError = data.error?.message || `제미나이 오류 ${res.status}`
      continue
    }
    const parsed = readJsonObject(data.candidates?.[0]?.content?.parts?.[0]?.text || "")
    if (parsed) return { raw: parsed, error: "" }
    lastError = "제미나이가 문제를 JSON으로 주지 않았습니다"
  }
  return { raw: null, error: lastError }
}

export async function generateBalanceQuestion(category: BalanceCategoryId, avoid: string[] = []) {
  const prompt = buildPrompt(category, avoid)
  const openAi = await fromOpenAI(prompt)
  if (openAi) {
    const question = parseBalanceQuestion(openAi, category)
    if (question) return question
  }
  const gemini = await fromGemini(prompt)
  const question = parseBalanceQuestion(gemini.raw, category)
  if (question) return question
  throw new Error(gemini.error || "문제를 만들지 못했습니다")
}

export function hasBalanceAi() {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
}
