import { describe, expect, it } from "vitest";
import {
  computeSleepMinutes,
  evaluateSleep,
  isEarlyBed,
  isPastMidnightBed,
  weightDeltaComment,
} from "./sleep";

describe("computeSleepMinutes", () => {
  it("저녁에 자고 다음날 아침에 일어나면 차이 계산", () => {
    expect(computeSleepMinutes(23, 30, 6, 30)).toBe(7 * 60); // 23:30 → 06:30 = 7h
    expect(computeSleepMinutes(22, 0, 6, 0)).toBe(8 * 60); // 22:00 → 06:00 = 8h
  });

  it("자정 이후 취침 후 아침 기상도 같은 날로 계산", () => {
    expect(computeSleepMinutes(1, 0, 7, 0)).toBe(6 * 60); // 01:00 → 07:00 = 6h
    expect(computeSleepMinutes(2, 30, 6, 0)).toBe(3 * 60 + 30); // 2:30 → 6:00 = 3.5h
  });

  it("같으면 0", () => {
    expect(computeSleepMinutes(0, 0, 0, 0)).toBe(0);
  });
});

describe("isPastMidnightBed", () => {
  it("0~11시는 자정 이후 취침으로 간주", () => {
    expect(isPastMidnightBed(0)).toBe(true);
    expect(isPastMidnightBed(1)).toBe(true);
    expect(isPastMidnightBed(11)).toBe(true);
    expect(isPastMidnightBed(12)).toBe(false);
    expect(isPastMidnightBed(22)).toBe(false);
    expect(isPastMidnightBed(23)).toBe(false);
  });
});

describe("isEarlyBed", () => {
  it("22:30 이하만 조기 취침", () => {
    expect(isEarlyBed(22, 0)).toBe(true);
    expect(isEarlyBed(22, 30)).toBe(true);
    expect(isEarlyBed(22, 40)).toBe(false);
    expect(isEarlyBed(23, 0)).toBe(false);
    expect(isEarlyBed(21, 50)).toBe(true);
  });
});

describe("evaluateSleep", () => {
  it("5시간 미만 → danger", () => {
    const r = evaluateSleep(23, 0, 3, 0); // 4h
    expect(r.status).toBe("danger");
    expect(r.message).toContain("반쪽짜리");
    expect(r.durationMinutes).toBe(4 * 60);
  });

  it("자정 이후 취침이면 7시간이어도 danger", () => {
    const r = evaluateSleep(1, 0, 8, 0); // 7h but pastMidnight
    expect(r.status).toBe("danger");
    expect(r.pastMidnight).toBe(true);
  });

  it("7시간 이상 + 22:30 이전 취침도 칭찬이 아닌 neutral (점수·메시지 제거)", () => {
    const r = evaluateSleep(22, 0, 6, 0); // 8h
    expect(r.status).toBe("neutral");
    expect(r.message).toBe("");
  });

  it("과수면(예: 18시→14시, 20h)도 칭찬하지 않고 neutral", () => {
    const r = evaluateSleep(18, 0, 14, 0); // 20h
    expect(r.status).toBe("neutral");
    expect(r.message).toBe("");
  });

  it("7시간 이상이지만 23시 취침은 neutral", () => {
    const r = evaluateSleep(23, 0, 7, 0); // 8h, late bed
    expect(r.status).toBe("neutral");
    expect(r.message).toBe("");
  });

  it("23:30 ~ 6:00 (6.5h) → neutral", () => {
    const r = evaluateSleep(23, 30, 6, 0);
    expect(r.status).toBe("neutral");
  });

  it("새벽 0시 취침·8시 기상은 8시간이더라도 danger (자정 이후)", () => {
    const r = evaluateSleep(0, 0, 8, 0);
    expect(r.status).toBe("danger");
    expect(r.pastMidnight).toBe(true);
  });
});

describe("weightDeltaComment", () => {
  it("어제 데이터 없으면 빈 메시지", () => {
    expect(weightDeltaComment(null, 60).message).toBe("");
    expect(weightDeltaComment(60, null).message).toBe("");
  });

  it("동일하면 빈 메시지", () => {
    expect(weightDeltaComment(60.0, 60.0).message).toBe("");
  });

  it("감량은 -100g 형식", () => {
    const r = weightDeltaComment(60.5, 60.4);
    expect(r.deltaG).toBe(-100);
    expect(r.message).toContain("-100g");
    expect(r.message).toContain("삭제 성공");
  });

  it("증량은 +100g 형식", () => {
    const r = weightDeltaComment(60.0, 60.1);
    expect(r.deltaG).toBe(100);
    expect(r.message).toContain("+100g");
    expect(r.message).toContain("다지는 중");
  });
});
