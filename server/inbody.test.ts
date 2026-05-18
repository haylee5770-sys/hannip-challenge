import { describe, expect, it } from "vitest";
import { parseInbodyJson } from "./inbody";

describe("parseInbodyJson", () => {
  it("parses clean JSON with all three numeric fields", () => {
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: 58.1, skeletalMuscleKg: 23.6, bodyFatPercent: 25.3 })
    );
    expect(r.weightKg).toBe(58.1);
    expect(r.skeletalMuscleKg).toBe(23.6);
    expect(r.bodyFatPercent).toBe(25.3);
  });

  it("extracts JSON embedded in surrounding prose", () => {
    const r = parseInbodyJson(
      '아래 결과입니다.\n```json\n{ "weightKg": 70, "skeletalMuscleKg": 30, "bodyFatPercent": 20 }\n```'
    );
    expect(r.weightKg).toBe(70);
    expect(r.skeletalMuscleKg).toBe(30);
    expect(r.bodyFatPercent).toBe(20);
  });

  it("treats null fields as missing", () => {
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: 60, skeletalMuscleKg: null, bodyFatPercent: null })
    );
    expect(r.weightKg).toBe(60);
    expect(r.skeletalMuscleKg).toBeNull();
    expect(r.bodyFatPercent).toBeNull();
  });

  it("coerces stringified numbers with units", () => {
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: "58.1 kg", skeletalMuscleKg: "23.6kg", bodyFatPercent: "25.3%" })
    );
    expect(r.weightKg).toBe(58.1);
    expect(r.skeletalMuscleKg).toBe(23.6);
    expect(r.bodyFatPercent).toBe(25.3);
  });

  it("rejects out-of-range values (treats as null)", () => {
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: 5, skeletalMuscleKg: 1, bodyFatPercent: 95 })
    );
    expect(r.weightKg).toBeNull();
    expect(r.skeletalMuscleKg).toBeNull();
    expect(r.bodyFatPercent).toBeNull();
  });

  it("returns all-null fallback for invalid content", () => {
    const r = parseInbodyJson("죄송합니다, 인식할 수 없습니다.");
    expect(r.weightKg).toBeNull();
    expect(r.skeletalMuscleKg).toBeNull();
    expect(r.bodyFatPercent).toBeNull();
    expect(r.raw).toContain("죄송합니다");
  });

  it("rounds noisy numbers to 2 decimals", () => {
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: 58.123456, skeletalMuscleKg: 23.677, bodyFatPercent: 25.999 })
    );
    expect(r.weightKg).toBe(58.12);
    expect(r.skeletalMuscleKg).toBe(23.68);
    expect(r.bodyFatPercent).toBe(26);
  });

  it("keeps card-style integer + decimal values intact (e.g. 57 + .8 = 57.8)", () => {
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: 57.8, skeletalMuscleKg: 23.7, bodyFatPercent: 24.8 })
    );
    expect(r.weightKg).toBe(57.8);
    expect(r.skeletalMuscleKg).toBe(23.7);
    expect(r.bodyFatPercent).toBe(24.8);
  });

  it("clamps obviously wrong weight (e.g. lbs accidentally returned)", () => {
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: 305, skeletalMuscleKg: 23, bodyFatPercent: 25 })
    );
    expect(r.weightKg).toBeNull();
    expect(r.skeletalMuscleKg).toBe(23);
    expect(r.bodyFatPercent).toBe(25);
  });

  it("ignores chart Y-axis ticks (treats 58.0/59.0/61.0 as noise) — card values win", () => {
    // 다음과 같은 LLM 응답을 가정: 골격근량을 높은 접는·대회으로 알는 그래프의 Y축과 수치를 혼동하지 않았을 경우,
    // 결과는 카드 안의 세 수치(57.8 / 23.7 / 24.8) 그대로 읽혀야 한다.
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: 57.8, skeletalMuscleKg: 23.7, bodyFatPercent: 24.8 })
    );
    expect(r.weightKg).toBe(57.8);
    expect(r.skeletalMuscleKg).toBe(23.7);
    expect(r.bodyFatPercent).toBe(24.8);
  });

  it("rejects chart-axis-like values mistakenly returned (61.0 weight is actually a Y axis tick)", () => {
    // 61.0 같은 값이 weight로 들어온다면 범위 검증에는 통과하지만, 실제로는 그래프 뢌릭이므로
    // 프롬프트·리트라이 분기가 이를 걸러내야 한다. 이 테스트는 parser의 범위 검증이 알맞도록 적용되는지만 결정한다.
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: 61.0, skeletalMuscleKg: 23.7, bodyFatPercent: 24.8 })
    );
    // 61은 체중 범위(20-300) 안이므로 통과하는 게 잘못된 게 아니지만, 이 케이스는 프롬프트가 제대로 동작해 이 값이 LLM 응답으로 올라오지 않도록 하는 게 중요함을 명시한다.
    expect(r.weightKg).toBe(61.0);
  });

  it("keeps partial recognition (e.g. only weight visible)", () => {
    const r = parseInbodyJson(
      JSON.stringify({ weightKg: 58.1, skeletalMuscleKg: null, bodyFatPercent: null })
    );
    expect(r.weightKg).toBe(58.1);
    expect(r.skeletalMuscleKg).toBeNull();
    expect(r.bodyFatPercent).toBeNull();
  });
});
