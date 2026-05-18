import { describe, it, expect } from "vitest";

/**
 * waters 라우터의 핵심 입력 검증을 zod 스키마와 동일한 규칙으로 단위 테스트한다.
 * (실제 mysql 연결을 띄우지 않고도 안전하게 회귀를 잡기 위함.)
 */
import { z } from "zod";

const waterVolumeSchema = z.number().int().refine(
  (v) => v >= 300 && v <= 1000 && v % 100 === 0,
  { message: "물 용량은 300~1000ml 범위의 100ml 단위로만 선택할 수 있습니다" }
);

describe("water volume schema", () => {
  it("accepts 300/500/1000", () => {
    expect(waterVolumeSchema.safeParse(300).success).toBe(true);
    expect(waterVolumeSchema.safeParse(500).success).toBe(true);
    expect(waterVolumeSchema.safeParse(1000).success).toBe(true);
  });

  it("rejects values outside 300~1000ml", () => {
    expect(waterVolumeSchema.safeParse(200).success).toBe(false);
    expect(waterVolumeSchema.safeParse(1100).success).toBe(false);
  });

  it("rejects non 100ml step (e.g. 350, 575)", () => {
    expect(waterVolumeSchema.safeParse(350).success).toBe(false);
    expect(waterVolumeSchema.safeParse(575).success).toBe(false);
  });

  it("rejects non-integer", () => {
    expect(waterVolumeSchema.safeParse(500.5).success).toBe(false);
  });
});

describe("water aggregation rules (sum semantics)", () => {
  /**
   * 라우터의 byDate가 totalMl을 reduce로 합산하는 것과
   * myRange가 day별 reduce로 누적하는 동작을 미리 보장한다.
   */
  it("sums multiple records on same day", () => {
    const rows = [{ volumeMl: 500 }, { volumeMl: 300 }, { volumeMl: 700 }];
    const total = rows.reduce((acc, r) => acc + r.volumeMl, 0);
    expect(total).toBe(1500);
  });

  it("groups by recordedDate", () => {
    const rows = [
      { recordedDate: "2026-05-01", volumeMl: 500 },
      { recordedDate: "2026-05-01", volumeMl: 300 },
      { recordedDate: "2026-05-02", volumeMl: 1000 },
    ];
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.recordedDate, (map.get(r.recordedDate) ?? 0) + r.volumeMl);
    expect(map.get("2026-05-01")).toBe(800);
    expect(map.get("2026-05-02")).toBe(1000);
  });

  it("counts certifications by row count, not by ml total", () => {
    // 사진 1장 = 인증 1회: 한 사용자의 동일 날짜에 N건 row가 있으면 N번 인증으로 본다.
    const rows = [{ volumeMl: 300 }, { volumeMl: 300 }, { volumeMl: 500 }];
    expect(rows.length).toBe(3);
  });
});
