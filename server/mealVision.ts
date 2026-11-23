// 식단 사진 AI 분석 (2026-11-20) — 사진만 올리면 무엇을 먹었는지 + 탄·단·지·채소 대략값
// 2026-11-23 정확도 개선 (해이 요청):
//  ① 사진을 고화질(detail: high)로 본다
//  ② 음식마다 '몇 g'을 먼저 어림하고, 표준 영양값(100g당)으로 음식별 탄단지를 계산해 서버에서 더한다
//  ③ 크루가 적은 한 줄 힌트("수육 앞다리, 밥 반 공기")를 가장 믿을 만한 정보로 쓴다
import { invokeLLM } from "./_core/llm";

export type MealVisionItem = { name: string; grams: number; carbsG: number; proteinG: number; fatG: number; vegetableG: number };
export type MealVisionResult = {
  foods: string;        // "수육 150g, 쌈채소 50g, 쌈장 15g" 처럼 한 줄
  carbsG: number;
  proteinG: number;
  fatG: number;
  vegetableG: number;
  items: MealVisionItem[];
};

const SYSTEM = [
  "당신은 한국 다이어트 코치를 돕는 영양 분석가입니다. 사진 속 한 끼의 탄수화물·단백질·지방·채소량(g)을 최대한 정확하게 추정합니다.",
  "",
  "순서를 반드시 지키세요:",
  "1) 사진에 보이는 음식을 하나씩 나눕니다. 밥·반찬·국·소스·음료를 따로 적습니다. (예: 돼지고기 수육, 쌈채소, 쌈장, 새우젓, 김치)",
  "2) 음식마다 먹은 양을 g으로 어림합니다. 접시·밥공기(지름 약 11cm, 밥 한 공기 약 210g)·숟가락(약 4cm 폭)·젓가락(약 20cm)·손 같은 물건을 크기 기준으로 씁니다.",
  "   고기는 부위(앞다리·삼겹·목살 등)와 비계 비율을 사진에서 보고 판단합니다. 소스·기름·드레싱도 빠뜨리지 않습니다.",
  "3) 음식마다 한국 식품의약품안전처 식품영양성분 데이터베이스 수준의 표준값(100g당)을 떠올려, 그 양에 맞게 탄·단·지를 계산합니다.",
  "   vegetableG는 그 음식 중 채소·나물·샐러드·쌈채소의 무게(g)입니다. 과일·감자·고구마·옥수수는 채소에 넣지 않습니다.",
  "",
  "사용자 힌트가 있으면 사진보다 힌트를 우선합니다(음식 종류·부위·양). 힌트에 없는 부분만 사진으로 판단합니다.",
  "name은 한국어로 짧게 씁니다(예: '돼지 앞다리 수육'). 숫자는 정수로 씁니다.",
  "음식이 아니거나 알아볼 수 없으면 items를 빈 배열로 둡니다.",
].join("\n");

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          carbsG: { type: "number" },
          proteinG: { type: "number" },
          fatG: { type: "number" },
          vegetableG: { type: "number" },
        },
        required: ["name", "grams", "carbsG", "proteinG", "fatG", "vegetableG"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const clamp = (n: unknown, max: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
};

export async function analyzeMealImage(imageUrls: string[], hint?: string): Promise<MealVisionResult> {
  const h = (hint ?? "").trim().slice(0, 300);
  const response = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `이 식사 사진(여러 장이면 한 끼로 합쳐서)을 분석해 JSON으로 답해 주세요.${h ? `\n사용자 힌트: ${h}` : ""}` },
          ...imageUrls.slice(0, 4).map(url => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "meal_vision_items", strict: true, schema: SCHEMA },
    },
  } as any);
  const content = (response as any)?.choices?.[0]?.message?.content ?? "";
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  try {
    const j = JSON.parse(raw);
    const items: MealVisionItem[] = (Array.isArray(j.items) ? j.items : []).slice(0, 15).map((it: any) => ({
      name: String(it.name ?? "").slice(0, 40),
      grams: clamp(it.grams, 3000),
      carbsG: clamp(it.carbsG, 1000),
      proteinG: clamp(it.proteinG, 1000),
      fatG: clamp(it.fatG, 1000),
      vegetableG: clamp(it.vegetableG, 2000),
    })).filter((it: MealVisionItem) => it.name);
    if (!items.length) return { foods: "음식을 알아보기 어려워요", carbsG: 0, proteinG: 0, fatG: 0, vegetableG: 0, items: [] };
    const sum = (k: keyof MealVisionItem) => items.reduce((a, it) => a + (it[k] as number), 0);
    return {
      foods: items.map(it => `${it.name} ${it.grams}g`).join(", ").slice(0, 300),
      carbsG: sum("carbsG"), proteinG: sum("proteinG"), fatG: sum("fatG"), vegetableG: sum("vegetableG"),
      items,
    };
  } catch {
    console.warn("[mealVision] parse failed", raw.slice(0, 200));
    return { foods: "", carbsG: 0, proteinG: 0, fatG: 0, vegetableG: 0, items: [] };
  }
}
