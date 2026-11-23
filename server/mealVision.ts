// 식단 사진 AI 분석 (2026-11-20) — 사진만 올리면 무엇을 먹었는지 + 탄·단·지 대략값
// 2026-11-23 정확도 개선 (해이 요청):
//  ① 사진을 고화질(detail: high)로 본다
//  ② AI는 음식 이름 · 먹은 g · '100g당' 영양값만 말하고, 곱셈은 서버가 한다
//     (AI가 곱셈을 직접 하다 삼겹살 수육 150g에 단백질 17g처럼 틀리고, 같은 사진에 매번 다른 답을 냈음)
//  ③ 자주 먹는 음식은 기준표(100g당)를 주고 그 값을 쓰게 한다 · temperature 0 으로 답을 고정
//  ④ 크루가 적은 한 줄 힌트("수육 앞다리, 밥 반 공기")를 가장 믿을 만한 정보로 쓴다
import { invokeLLM } from "./_core/llm";

export type MealVisionItem = { name: string; grams: number; carbsG: number; proteinG: number; fatG: number; vegetableG: number };
export type MealVisionResult = {
  foods: string;        // "돼지 삼겹살 수육 150g, 무김치 50g" 처럼 한 줄
  carbsG: number;
  proteinG: number;
  fatG: number;
  vegetableG: number;   // 0보다 크면 '야채 먹음'
  items: MealVisionItem[];
};

/** 100g당 기준값 (식약처 식품영양성분 DB 근사, 조리된 상태) — 표에 있는 음식은 반드시 이 값 */
const REFERENCE = [
  "돼지 삼겹살 수육/보쌈: 탄 0 · 단 19 · 지 29",
  "돼지 앞다리·목살 수육: 탄 0 · 단 23 · 지 14",
  "돼지 목살 구이: 탄 0 · 단 21 · 지 20",
  "돼지 삼겹살 구이: 탄 0 · 단 17 · 지 38",
  "소고기 등심 구이: 탄 0 · 단 24 · 지 18",
  "닭가슴살(익힌): 탄 0 · 단 31 · 지 3",
  "닭다리살(익힌, 껍질 포함): 탄 0 · 단 24 · 지 13",
  "연어(익힌): 탄 0 · 단 22 · 지 12",
  "고등어구이: 탄 0 · 단 21 · 지 16",
  "삶은 달걀(1개 약 50g): 탄 1 · 단 13 · 지 10",
  "두부: 탄 2 · 단 9 · 지 5",
  "흰쌀밥(한 공기 약 210g): 탄 33 · 단 2.6 · 지 0.3",
  "현미밥·잡곡밥: 탄 32 · 단 3 · 지 1",
  "찐 고구마: 탄 30 · 단 1.4 · 지 0.2",
  "배추김치: 탄 4 · 단 1.5 · 지 0.5",
  "깍두기·무김치: 탄 5 · 단 1 · 지 0.3",
  "나물무침: 탄 6 · 단 2.5 · 지 3",
  "쌈채소·상추·양배추·샐러드 채소: 탄 3 · 단 1.2 · 지 0.2",
  "쌈장: 탄 27 · 단 9 · 지 6",
  "새우젓: 탄 2 · 단 9 · 지 1",
  "그릭요거트(무가당): 탄 4 · 단 10 · 지 4",
  "바나나: 탄 22 · 단 1 · 지 0.3",
  "사과: 탄 14 · 단 0.3 · 지 0.2",
].join("\n");

const SYSTEM = [
  "당신은 한국 다이어트 코치를 돕는 영양 분석가입니다. 사진 속 한 끼를 음식별로 나누고, 먹은 양(g)과 100g당 영양값을 답합니다.",
  "",
  "순서:",
  "1) 사진에 보이는 음식을 하나씩 나눕니다. 밥·반찬·국·소스·음료를 따로 적습니다.",
  "2) 음식마다 먹은 양을 g으로 어림합니다. 밥공기(지름 약 11cm, 밥 한 공기 약 210g)·숟가락(폭 약 4cm)·젓가락(약 20cm)·접시를 크기 기준으로 씁니다.",
  "   고기는 부위(삼겹·앞다리·목살 등)를 비계 비율로 판단합니다. 고기 한 점은 보통 10~20g입니다.",
  "3) 음식마다 '100g당' 탄수화물·단백질·지방(g)을 답합니다. 곱셈은 하지 마세요. 서버가 계산합니다.",
  "   아래 기준표에 있는 음식은 반드시 표의 값을 그대로 씁니다. 없는 음식만 식약처 식품영양성분 DB 수준의 값으로 답합니다.",
  "4) isVegetable: 채소·나물·김치·쌈채소·샐러드면 true. 과일·감자·고구마·옥수수·버섯이 아닌 곡류는 false.",
  "",
  "사용자 힌트가 있으면 사진보다 힌트를 우선합니다(음식 종류·부위·양).",
  "name은 한국어로 짧게(예: '돼지 삼겹살 수육'). 음식이 아니거나 알아볼 수 없으면 items를 빈 배열로 둡니다.",
  "",
  "[100g당 기준표]",
  REFERENCE,
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
          carbsPer100g: { type: "number" },
          proteinPer100g: { type: "number" },
          fatPer100g: { type: "number" },
          isVegetable: { type: "boolean" },
        },
        required: ["name", "grams", "carbsPer100g", "proteinPer100g", "fatPer100g", "isVegetable"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const num = (n: unknown, max: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
};

export async function analyzeMealImage(imageUrls: string[], hint?: string): Promise<MealVisionResult> {
  const h = (hint ?? "").trim().slice(0, 300);
  const response = await invokeLLM({
    temperature: 0,
    seed: 7,
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
      json_schema: { name: "meal_vision_per100", strict: true, schema: SCHEMA },
    },
  } as any);
  const content = (response as any)?.choices?.[0]?.message?.content ?? "";
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  try {
    const j = JSON.parse(raw);
    const items: MealVisionItem[] = (Array.isArray(j.items) ? j.items : []).slice(0, 15).map((it: any) => {
      const grams = Math.round(num(it.grams, 3000));
      const k = grams / 100;
      return {
        name: String(it.name ?? "").slice(0, 40),
        grams,
        carbsG: Math.round(num(it.carbsPer100g, 100) * k),
        proteinG: Math.round(num(it.proteinPer100g, 100) * k),
        fatG: Math.round(num(it.fatPer100g, 100) * k),
        vegetableG: it.isVegetable ? grams : 0,
      };
    }).filter((it: MealVisionItem) => it.name);
    if (!items.length) return { foods: "음식을 알아보기 어려워요", carbsG: 0, proteinG: 0, fatG: 0, vegetableG: 0, items: [] };
    const sum = (key: "carbsG" | "proteinG" | "fatG" | "vegetableG") => items.reduce((a, it) => a + it[key], 0);
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
