import { describe, expect, it } from "vitest";
import { formatLocalDate, todayLocal, displayName } from "./utils";

describe("shared/utils", () => {
  it("formatLocalDate는 YYYY-MM-DD 형식을 반환한다", () => {
    const d = new Date(2026, 0, 5); // Jan 5, 2026
    expect(formatLocalDate(d)).toBe("2026-01-05");
  });

  it("todayLocal은 YYYY-MM-DD 형식이다", () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("displayName은 name이 우선한다", () => {
    expect(displayName({ name: "김희선", email: "kim@example.com" })).toBe("김희선");
  });

  it("displayName은 name이 없으면 email 앞부분을 반환한다", () => {
    expect(displayName({ name: null, email: "alice@example.com" })).toBe("alice");
  });

  it("displayName은 둘 다 없으면 '이름 없음'을 반환한다", () => {
    expect(displayName({ name: null, email: null })).toBe("이름 없음");
  });
});
