/**
 * Inbody photo analysis — extract weight (kg), skeletal muscle mass (kg) and
 * body-fat percentage (%) from a user-uploaded inbody result photo using the
 * built-in LLM with vision support.
 *
 * The function is split so the parsing logic is unit-testable independently of
 * the actual LLM call.
 */
import { invokeLLM } from "./_core/llm";

export type InbodyExtractResult = {
  weightKg: number | null;
  skeletalMuscleKg: number | null;
  bodyFatPercent: number | null;
  raw: string;
};

/**
 * 인바디 카드/리포트 캡처에 특화된 시스템 프롬프트.
 *
 * 한국 사용자가 자주 올리는 변형 케이스를 모두 커버:
 *   - 카드형 3-박스 ("체중 (kg)", "골격근량 (kg)", "체지방률 (%)") + "표준" 같은 평가 라벨
 *   - 인바디270/370/570/770 공식 결과지 표
 *   - 모바일 캡처에서 잘리거나 회전·기울기·반사가 있는 사진
 *   - 한국어 또는 영어 라벨 (Weight / Skeletal Muscle Mass / SMM / PBF / Body Fat)
 *
 * 모델이 "추측"으로 채우지 않도록, 명확히 보이지 않는 값은 반드시 null 로 두라고 강제한다.
 * 분리된 두 박스가 있을 경우 한 화면 내에서 가장 큰 숫자 / 가장 명확한 숫자를 우선 채택.
 */
const SYSTEM_PROMPT = [
  "당신은 한국 사용자가 업로드한 InBody 결과 사진(또는 다이어트 앱의 카드형 인바디 요약 캐폐)에서 핵심 신체 수치 3가지를 추출하는 전문 OCR 도우미입니다.",
  "",
  "추출 대상 (정확히 이 3가지만):",
  "  1) 체중 — Weight, 체중, BW, 단위 kg",
  "  2) 골격근량 — Skeletal Muscle Mass, SMM, 골격근량, 근육량 (단, 단순 '근육량' 항목이 SMM과 별도로 있는 경우에만 SMM 수치를 우선 사용), 단위 kg",
  "  3) 체지방률 — Body Fat Percentage, PBF, 체지방률, 단위 %",
  "",
  "카드형 우선 규칙 (외부 앱의 인바디 요약 캐폐에 특화):",
  "  - '체중(kg)', '골격근량(kg)', '체지방률(%)' 세 개의 조그만한 카드 상자가 한 행으로 나열된 레이아웃이 가장 신뢰할 수 있는 근거이다. 이 세 카드 안의 대형 숫자만 결과로 삼는다.",
  "  - 각 카드 안 숫자는 대부분 '큰 정수 + 작은 소수 (.\u00b7\u00b7)' 구조다. 둘을 합쳐서 한 숫자로 읽는다. 예) '57' + '.8' → 57.8 / '23' + '.7' → 23.7 / '24' + '.8' → 24.8.",
  "  - 카드 아래의 '표준', '낮음', '높음' 같은 평가 배지/치 라벨은 절대 숫자로 읽지 않는다.",
  "  - 카드 세트 바로 아래의 꾩은선 차트(58.0 / 59.0 / 60.0 / 61.0 같은 Y축 뢌릭), 날짜/시간 투틁(26.05.17 09:48), 투틁 내 보조 수치(예: '57.8kg' 이니용)은 참고하지 않는다. 차트 영역의 숫자는 그래프의 Y축 뢌릭이며 현재 체중과 관련이 없다.",
  "  - 동일 수치가 투틁과 카드 양쪽에 모두 보일 때는 항상 큰 카드 안의 숫자를 우선한다.",
  "",
  "엄격 규칙:",
  "  - 사진에 명확히 보이는 숫자만 사용한다. 흐릿하거나, 가려져 있거나, 헷갈리면 반드시 null.",
  "  - 골격근량과 체지방량(체지방 무게, kg) 또는 근육량(MM)을 혼동하지 말 것. '체지방률(%)' 라벨이 붙은 % 값만 bodyFatPercent에 넣는다.",
  "  - 단위를 신중히 확인: kg, %는 그대로 사용. lb/lbs로 표기되어 있으면 kg로 환산하지 말고 null로 둔다.",
  "  - 카드형 캐폐에서 숫자 앞뒤로 나뉘어 표시되는 경우(예: 큰 폰트 '57' + 작은 폰트 '.8')도 한 숫자(57.8)로 합쳐서 읽는다.",
  "  - JSON 외 다른 설명 텍스트를 절대로 출력하지 않는다.",
].join("\n");

const USER_PROMPT = [
  "이 사진은 사용자의 인바디 측정 결과 화면 또는 인바디 요약 카드입니다.",
  "다음 세 값을 추출해 정확한 JSON 한 개로만 답하세요:",
  "  - weightKg: 체중 (kg, 소수 1자리까지 일반적). 사진에서 읽을 수 없으면 null.",
  "  - skeletalMuscleKg: 골격근량 (kg, SMM). 사진에서 읽을 수 없으면 null.",
  "  - bodyFatPercent: 체지방률 (%, PBF). 사진에서 읽을 수 없으면 null.",
  "",
  "응답은 반드시 다음 JSON 스키마 그대로:",
  '{ "weightKg": number | null, "skeletalMuscleKg": number | null, "bodyFatPercent": number | null }',
].join("\n");

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    weightKg: { type: ["number", "null"], description: "Body weight in kilograms" },
    skeletalMuscleKg: { type: ["number", "null"], description: "Skeletal muscle mass in kilograms" },
    bodyFatPercent: { type: ["number", "null"], description: "Body fat percentage (0-100)" },
  },
  required: ["weightKg", "skeletalMuscleKg", "bodyFatPercent"],
  additionalProperties: false,
} as const;

/**
 * Parse JSON content returned from the LLM.
 * Robust to extra prose around the JSON payload (some models add text
 * before/after the object).
 */
export function parseInbodyJson(content: string): InbodyExtractResult {
  const fallback: InbodyExtractResult = {
    weightKg: null,
    skeletalMuscleKg: null,
    bodyFatPercent: null,
    raw: content,
  };

  if (!content) return fallback;

  // Try direct JSON parse first; fall back to extracting the first {...} block.
  let payload: unknown = null;
  try {
    payload = JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        payload = JSON.parse(content.slice(start, end + 1));
      } catch {
        return fallback;
      }
    } else {
      return fallback;
    }
  }

  if (!payload || typeof payload !== "object") return fallback;
  const obj = payload as Record<string, unknown>;

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      // 숫자/소수점/마이너스만 남기고 정리. 한국어 단위(kg, %)와 공백 제거.
      const cleaned = v.replace(/[^0-9.\-]/g, "");
      if (!cleaned) return null;
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  return {
    weightKg: clampPositive(num(obj.weightKg), 20, 300),
    skeletalMuscleKg: clampPositive(num(obj.skeletalMuscleKg), 5, 80),
    bodyFatPercent: clampPercent(num(obj.bodyFatPercent)),
    raw: content,
  };
}

function clampPositive(v: number | null, min: number, max: number): number | null {
  if (v === null) return null;
  if (!Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return Math.round(v * 100) / 100;
}

function clampPercent(v: number | null): number | null {
  if (v === null) return null;
  if (!Number.isFinite(v)) return null;
  if (v < 1 || v > 70) return null;
  return Math.round(v * 100) / 100;
}

/**
 * Run LLM vision on an image URL and return the parsed numeric values.
 * The image URL must be publicly fetchable by the model (we use the
 * /manus-storage/* signed redirect URL produced by storagePut).
 *
 * 네 단계 호출 — 그중 하나라도 null이면 다음 단계로 넘어간다 (카드형은 3값이 동시 노출이 맞으므로 일부만 채워지는 건 실절 실패로 간주):
 *   1) high-detail 비전 (기본 프롬프트)
 *   2) 누락이 있으면 OCR 보강 프롬프트로 재시도
 *   3) 곧장 카드 영역 전용 강하게 제약한 프롬프트
 *   4) 웹 OCR-then-extract: _ocr 필드(자유 서술)로 먼저 모든 라벨·숫자를 적게 한 뒤 그 안에서만 카드 수치를 매핑 — 가장 도움 되는 마지막 수단
 */
export async function analyzeInbodyImage(imageUrl: string): Promise<InbodyExtractResult> {
  const first = await invokeOnce(imageUrl, USER_PROMPT, "1-default");
  if (isComplete(first)) return first;

  // 2차: OCR-leaning
  const retryPrompt = [
    "이 사진은 인바디 결과/요약 캐폐입니다. 먼저 사진에 보이는 모든 숫자와 그 옆 라벨을 머릿속으로 정리한 뒤,",
    "체중(kg), 골격근량(kg, SMM), 체지방률(%) 세 가지만 추출해 JSON으로 답하세요.",
    "꾩은선 차트의 Y축 뢌릭(58.0, 59.0, 60.0, 61.0 등)과 날짜 투틁의 보조 수치는 무시하고, 머리에 세 개의 카드(체중·골격근량·체지방률)가 있다면 그 카드 안의 대형 숫자만 사용하세요.",
    "여전히 보이지 않는 값은 null. 응답은 JSON만.",
    '{ "weightKg": number | null, "skeletalMuscleKg": number | null, "bodyFatPercent": number | null }',
  ].join("\n");
  const second = await invokeOnce(imageUrl, retryPrompt, "2-ocr");
  if (isComplete(second)) return second;

  // 3차: 카드 영역 전용 강한 제약 프롬프트 (few-shot 예시 포함)
  const cardOnlyPrompt = [
    "이 사진의 머리에는 결과 요약 카드 세 개가 나란히 높여 있습니다: 체중(kg), 골격근량(kg), 체지방률(%).",
    "각 카드 안에는 '큰 정수 + 작은 소수' 구조의 대형 숫자가 대략 가운데에 있고, 그 아래에 '표준', '낮음', '높음' 같은 작은 배지가 있을 수 있으나 이 배지는 수치가 아니므로 읽지 않습니다.",
    "카드 세 개의 숫자를 왼쪽부터 순서대로 읽어 weightKg, skeletalMuscleKg, bodyFatPercent로 그대로 적으세요. 큰 숫자와 작은 숫자는 합쳐서 소수 한 자리로 표기합니다 — 예: '57' + '.8' → 57.8.",
    "아래 꾩은선 차트/날짜 투틁/축 레이블(58.0, 59.0, 60.0, 61.0)은 절대 읽지 않습니다.",
    "카드 3개가 보이지 않는 경우에만 해당 값을 null으로 둘다.",
    "응답은 JSON 하나만:",
    '{ "weightKg": number | null, "skeletalMuscleKg": number | null, "bodyFatPercent": number | null }',
  ].join("\n");
  const third = await invokeOnce(imageUrl, cardOnlyPrompt, "3-card");
  if (isComplete(third)) return third;

  // 4차: OCR-then-extract — 먼저 보이는 라벨·숫자를 자유 서술로 적게 한 뒤 그 안에서 추출
  const fourth = await invokeOcrThenExtract(imageUrl);
  // 다 실패하면 마지막 절장(or 일부라도 채워진 가장 좋은 결과)을 반환.
  return pickBest([first, second, third, fourth]);
}

function isComplete(r: InbodyExtractResult): boolean {
  return r.weightKg !== null && r.skeletalMuscleKg !== null && r.bodyFatPercent !== null;
}

function pickBest(results: InbodyExtractResult[]): InbodyExtractResult {
  // 더 많은 필드가 채워진 결과 우선, 동점이면 앞 단계 우선.
  let best = results[0];
  let bestScore = score(best);
  for (let i = 1; i < results.length; i++) {
    const s = score(results[i]);
    if (s > bestScore) {
      best = results[i];
      bestScore = s;
    }
  }
  return best;
}

function score(r: InbodyExtractResult): number {
  return (
    (r.weightKg !== null ? 1 : 0) +
    (r.skeletalMuscleKg !== null ? 1 : 0) +
    (r.bodyFatPercent !== null ? 1 : 0)
  );
}

async function invokeOnce(
  imageUrl: string,
  userPrompt: string,
  attemptLabel: string,
): Promise<InbodyExtractResult> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "inbody_extract",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  });

  const content = response?.choices?.[0]?.message?.content ?? "";
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  console.log(`[Inbody:${attemptLabel}] raw=`, raw);
  return parseInbodyJson(raw);
}

/**
 * 4차 OCR-then-extract — 머저 모델에게 "사진에 보이는 모든 라벨·숫자를 _ocr 필드에 적어달라"고 한 뒤,
 * 그 OCR 텍스트에서만 카드 3값을 골라달라고 한다. 단일 LLM 호출로 둘 다 수행하는 구조.
 * response_format 스키마에 _ocr 필드를 더해 모델이 자유서술한 텍스트도 함께 볼 수 있게 한다(디버그·품질용).
 */
async function invokeOcrThenExtract(imageUrl: string): Promise<InbodyExtractResult> {
  const ocrPrompt = [
    "단계 1) 사진에 보이는 모든 라벨(텍스트)과 그 옆에 있는 숫자를 한 줄씩 그대로 적으세요. 이 텍스트는 _ocr 필드에 멀티라인으로 담아요. 예: '인바디검사 요약 / 체중 (kg) 57.8 표준 / 골격근량 (kg) 23.7 표준 / 체지방률 (%) 24.8 표준 / 차트 Y축 58.0 59.0 60.0 61.0 / 투틁 26.05.17 09:48 57.8kg'.",
    "단계 2) 위 OCR 텍스트만 사용해 세 수치를 골르세요:",
    "  - weightKg: '체중 (kg)' 또는 'Weight' 라벨 옆의 숫자 (kg 단위). 소수 한 자리.",
    "  - skeletalMuscleKg: '골격근량 (kg)' 또는 'SMM/Skeletal Muscle' 라벨 옆의 숫자. 소수 한 자리.",
    "  - bodyFatPercent: '체지방률 (%)' 또는 'PBF/Body Fat' 라벨 옆의 숫자. 소수 한 자리.",
    "  - 차트 Y축 뢌릭(58.0, 59.0, 60.0, 61.0)과 날짜 투틁의 보조 수치(예: '57.8kg' 투틁)은 제외합니다. 투틁과 카드 양쪽에 같은 수치가 보이면 카드 우선.",
    "라벨이 명확하지 않은 수치는 null. 응답은 다음 JSON 스키마를 정확히 따르세요:",
    '{ "_ocr": string, "weightKg": number | null, "skeletalMuscleKg": number | null, "bodyFatPercent": number | null }',
  ].join("\n");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: ocrPrompt },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "inbody_extract_with_ocr",
        strict: true,
        schema: {
          type: "object",
          properties: {
            _ocr: { type: "string", description: "사진에 보이는 모든 라벨·숫자를 한 줄로 적은 자유 서술" },
            weightKg: { type: ["number", "null"], description: "체중 (kg)" },
            skeletalMuscleKg: { type: ["number", "null"], description: "골격근량 (kg, SMM)" },
            bodyFatPercent: { type: ["number", "null"], description: "체지방률 (%)" },
          },
          required: ["_ocr", "weightKg", "skeletalMuscleKg", "bodyFatPercent"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response?.choices?.[0]?.message?.content ?? "";
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  console.log(`[Inbody:4-ocrThenExtract] raw=`, raw);
  return parseInbodyJson(raw);
}
