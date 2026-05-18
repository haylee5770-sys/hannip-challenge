import { describe, it, expect } from "vitest";
import { dayNumber, totalDays, lossPercent } from "./seasons";

/**
 * 시즌 결과 리포트의 핵심 도메인 규칙을 단위 테스트로 고정한다.
 * - BEFORE 사진은 Day 1, AFTER 사진은 마지막 날에만 허용된다.
 * - 참여 점수 = 카테고리별 인증 합계 + (풀 출석 시 +13).
 * - 감량률 계산은 베이스라인 대비이며, 음수(증가)도 안전하게 처리된다.
 */

function isBeforeAllowed(start: string, end: string, today: string): boolean {
  return dayNumber(start, end, today) === 1;
}
function isAfterAllowed(start: string, end: string, today: string): boolean {
  const day = dayNumber(start, end, today);
  return day !== null && day === totalDays(start, end);
}

function participationScore(counts: { weight: number; meal: number; exercise: number }, total: number) {
  const sum = counts.weight + counts.meal + counts.exercise;
  const completed = counts.weight >= total && counts.meal >= total && counts.exercise >= total;
  return { sum, completed, score: sum + (completed ? 13 : 0) };
}

describe("season report domain rules", () => {
  const start = "2026-05-01";
  const end = "2026-05-13";

  it("BEFORE는 Day 1에만 허용된다", () => {
    expect(isBeforeAllowed(start, end, "2026-05-01")).toBe(true);
    expect(isBeforeAllowed(start, end, "2026-05-02")).toBe(false);
    expect(isBeforeAllowed(start, end, "2026-05-13")).toBe(false);
    expect(isBeforeAllowed(start, end, "2026-04-30")).toBe(false);
  });

  it("AFTER는 마지막 날에만 허용된다", () => {
    expect(isAfterAllowed(start, end, "2026-05-13")).toBe(true);
    expect(isAfterAllowed(start, end, "2026-05-12")).toBe(false);
    expect(isAfterAllowed(start, end, "2026-05-01")).toBe(false);
    expect(isAfterAllowed(start, end, "2026-05-14")).toBe(false);
  });

  it("참여 점수: 풀 출석 시 보너스 +13", () => {
    const total = totalDays(start, end); // 13
    const r1 = participationScore({ weight: 13, meal: 13, exercise: 13 }, total);
    expect(r1.completed).toBe(true);
    expect(r1.sum).toBe(39);
    expect(r1.score).toBe(52);
  });

  it("참여 점수: 한 카테고리만 부족해도 보너스 없음", () => {
    const total = totalDays(start, end);
    const r = participationScore({ weight: 13, meal: 13, exercise: 12 }, total);
    expect(r.completed).toBe(false);
    expect(r.score).toBe(38);
  });

  it("감량률: 베이스라인 대비 양/음 정확히 계산", () => {
    expect(lossPercent(70, 65.8)).toBeCloseTo(6, 1);
    expect(lossPercent(60, 60)).toBe(0);
    // 증가는 음수
    expect(lossPercent(60, 62)).toBeCloseTo(-3.333, 2);
  });

  it("감량률: 잘못된 입력은 0", () => {
    expect(lossPercent(null, 60)).toBe(0);
    expect(lossPercent(60, null)).toBe(0);
    expect(lossPercent(0, 60)).toBe(0);
  });
});
