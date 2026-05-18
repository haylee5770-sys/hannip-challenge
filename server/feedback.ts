/**
 * Rule-based instant feedback for meal nutrient inputs.
 * Returns an array of { tone, text } items so the UI can render visually.
 */
export type FeedbackTone = "warning" | "info" | "praise";
export type FeedbackItem = { tone: FeedbackTone; text: string };

export type FeedbackInput = {
  carbsG: number;
  proteinG: number;
  fatG: number;
  vegetableG: number;
  waterMl: number;
  /** Optional: today's other meals so we evaluate daily totals too. */
  mealsToday?: Array<{
    category: "breakfast" | "lunch" | "dinner" | "snack" | "regular" | "smoothie";
    carbsG: number;
    proteinG: number;
    fatG: number;
    vegetableG: number;
    waterMl: number;
  }>;
};

export function generateAutoFeedback(input: FeedbackInput): FeedbackItem[] {
  const items: FeedbackItem[] = [];
  const totals = {
    carbsG: input.carbsG,
    proteinG: input.proteinG,
    fatG: input.fatG,
    vegetableG: input.vegetableG,
    waterMl: input.waterMl,
  };
  if (input.mealsToday?.length) {
    for (const m of input.mealsToday) {
      totals.carbsG += m.carbsG;
      totals.proteinG += m.proteinG;
      totals.fatG += m.fatG;
      totals.vegetableG += m.vegetableG;
      totals.waterMl += m.waterMl;
    }
  }

  // Carbs
  if (input.carbsG === 0) {
    items.push({
      tone: "warning",
      text: "오늘 이 식사에 탄수화물을 섭취하지 않으셨어요. 기력이 떨어질 수 있으니 통곡물 빵이나 고구마, 현미 같은 좋은 탄수화물을 조금 곁들여 보세요.",
    });
  } else if (input.carbsG > 200) {
    items.push({
      tone: "info",
      text: "탄수화물 섭취가 다소 많아요. 다음 끼니에서는 양을 조절하시거나 식이섬유가 풍부한 채소를 함께 드시면 좋아요.",
    });
  }

  // Protein
  if (input.proteinG === 0) {
    items.push({
      tone: "warning",
      text: "단백질이 비어 있어요. 달걀, 두부, 닭가슴살, 그릭요거트 같은 양질의 단백질을 한 줌 더해 보세요.",
    });
  } else if (input.proteinG >= 30) {
    items.push({
      tone: "praise",
      text: "단백질 균형이 훌륭해요. 근육 회복과 포만감 유지에 큰 도움이 됩니다.",
    });
  }

  // Fat
  if (input.fatG > 60) {
    items.push({
      tone: "info",
      text: "지방 섭취가 다소 많아요. 견과류·아보카도 같은 좋은 지방 위주로 조절하시면 더 균형 잡힌 한 끼가 됩니다.",
    });
  }

  // Vegetables
  if (input.vegetableG === 0) {
    items.push({
      tone: "warning",
      text: "야채가 빠졌어요. 한 끼에 한 줌(약 100g) 이상의 채소를 더하면 식이섬유와 미세영양소가 풍부해져요.",
    });
  } else if (input.vegetableG >= 200) {
    items.push({
      tone: "praise",
      text: "채소 섭취가 풍성해요. 식이섬유와 항산화 영양소가 충분합니다.",
    });
  }

  // Water is tracked separately — no water hints in meal feedback

  // Macro balance praise
  const total = totals.carbsG + totals.proteinG + totals.fatG;
  if (total >= 60 && totals.proteinG >= 20 && totals.vegetableG >= 100) {
    items.push({
      tone: "praise",
      text: "탄단지·채소 균형이 좋아요. 이 페이스를 유지하시면 충분합니다.",
    });
  }

  return items;
}
