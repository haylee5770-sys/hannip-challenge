// 식단 사진 AI 분석 (2026-11-20) — 사진만 올리면 무엇을 먹었는지 + 탄·단·지·채소 대략값
import { invokeLLM } from "./_core/llm";

export type MealVisionResult = {
  foods: string;        // "현미밥 1공기, 닭가슴살 100g, 샐러드" 처럼 한 줄
  carbsG: number;
  proteinG: number;
  fatG: number;
  vegetableG: number;
};

const SYSTEM = [
  "당신은 한국 다이어트 코치를 돕는 영양 분석가입니다.",
  "사진 속 음식을 보고 무엇을 먹었는지와 대략적인 영양소(그램)를 추정합니다.",
  "한국 가정식·외식 기준 1인분으로 추정하고, 사진에 보이는 양을 반영합니다.",
  "vegetableG는 채소·나물·샐러드의 무게(g)입니다. 과일은 채소에 넣지 않습니다.",
  "음식이 아니거나 알아볼 수 없으면 foods에 '음식을 알아보기 어려워요'라고 쓰고 숫자는 0.",
].join("\n");

const SCHEMA = {
  type: "object",
  properties: {
    foods: { type: "string" },
    carbsG: { type: "number" },
    proteinG: { type: "number" },
    fatG: { type: "number" },
    vegetableG: { type: "number" },
  },
  required: ["foods", "carbsG", "proteinG", "fatG", "vegetableG"],
  additionalProperties: false,
};

const clamp = (n: unknown, max: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
};

export async function analyzeMealImage(imageUrls: string[]): Promise<MealVisionResult> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "이 식사 사진(여러 장이면 한 끼로 합쳐서)을 분석해 JSON으로 답해 주세요. foods는 한국어 한 줄." },
          ...imageUrls.slice(0, 4).map(url => ({ type: "image_url" as const, image_url: { url, detail: "low" as const } })),
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "meal_vision", strict: true, schema: SCHEMA },
    },
  } as any);
  const content = (response as any)?.choices?.[0]?.message?.content ?? "";
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  try {
    const j = JSON.parse(raw);
    return {
      foods: String(j.foods ?? "").slice(0, 300),
      carbsG: clamp(j.carbsG, 2000),
      proteinG: clamp(j.proteinG, 2000),
      fatG: clamp(j.fatG, 2000),
      vegetableG: clamp(j.vegetableG, 2000),
    };
  } catch {
    console.warn("[mealVision] parse failed", raw.slice(0, 200));
    return { foods: "", carbsG: 0, proteinG: 0, fatG: 0, vegetableG: 0 };
  }
}
