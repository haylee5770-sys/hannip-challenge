import { describe, expect, it } from "vitest";
import { generateAutoFeedback } from "./feedback";

describe("generateAutoFeedback", () => {
  it("탄수화물이 0이면 경고를 반환한다", () => {
    const items = generateAutoFeedback({
      carbsG: 0, proteinG: 20, fatG: 10, vegetableG: 100, waterMl: 500,
    });
    const carbsWarn = items.find(i => i.text.includes("탄수화물"));
    expect(carbsWarn).toBeDefined();
    expect(carbsWarn?.tone).toBe("warning");
  });

  it("단백질이 0이면 경고를 반환한다", () => {
    const items = generateAutoFeedback({
      carbsG: 50, proteinG: 0, fatG: 10, vegetableG: 100, waterMl: 500,
    });
    expect(items.some(i => i.tone === "warning" && i.text.includes("단백질"))).toBe(true);
  });

  it("야채가 0이면 경고를 반환한다", () => {
    const items = generateAutoFeedback({
      carbsG: 50, proteinG: 20, fatG: 10, vegetableG: 0, waterMl: 500,
    });
    expect(items.some(i => i.tone === "warning" && i.text.includes("야채"))).toBe(true);
  });

  it("하루 누적 수분이 1리터 미만이면 경고를 반환한다", () => {
    const items = generateAutoFeedback({
      carbsG: 50, proteinG: 20, fatG: 10, vegetableG: 100, waterMl: 300,
      mealsToday: [
        { category: "breakfast", carbsG: 0, proteinG: 0, fatG: 0, vegetableG: 0, waterMl: 200 },
      ],
    });
    expect(items.some(i => i.tone === "warning" && i.text.includes("1리터"))).toBe(true);
  });

  it("하루 누적 수분이 2리터 이상이면 칭찬을 반환한다", () => {
    const items = generateAutoFeedback({
      carbsG: 50, proteinG: 20, fatG: 10, vegetableG: 100, waterMl: 500,
      mealsToday: [
        { category: "breakfast", carbsG: 0, proteinG: 0, fatG: 0, vegetableG: 0, waterMl: 1500 },
      ],
    });
    expect(items.some(i => i.tone === "praise" && i.text.includes("수분"))).toBe(true);
  });

  it("탄·단·지·채소 균형이 좋으면 칭찬을 반환한다", () => {
    const items = generateAutoFeedback({
      carbsG: 60, proteinG: 30, fatG: 15, vegetableG: 150, waterMl: 500,
    });
    expect(items.some(i => i.tone === "praise" && i.text.includes("균형"))).toBe(true);
  });

  it("단백질 30g 이상이면 칭찬을 반환한다", () => {
    const items = generateAutoFeedback({
      carbsG: 50, proteinG: 35, fatG: 10, vegetableG: 100, waterMl: 500,
    });
    expect(items.some(i => i.tone === "praise" && i.text.includes("단백질"))).toBe(true);
  });
});
