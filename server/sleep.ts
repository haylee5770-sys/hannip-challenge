/**
 * Sleep evaluation — pure helpers, fully testable.
 *
 * Inputs are local-time hours/minutes for bed and wake. The wake time is assumed
 * to be on the date the user is recording (= 어제 노력의 결과 화면 날짜),
 * and bed time is the previous evening unless bed time itself is in the AM
 * after midnight (i.e. user went to bed past 00:00 and woke same morning).
 */

export type SleepStatus = "danger" | "neutral";
export type SleepEvaluation = {
  durationMinutes: number;
  status: SleepStatus;
  message: string;
  /** True when the user went to bed at or after 00:00 (자정 이후 취침). */
  pastMidnight: boolean;
};

/**
 * Compute total sleep minutes given wall-clock bed/wake times.
 * If the bed time is later in the day than the wake time, we assume the user
 * went to bed the previous evening (e.g., bed 23:30, wake 06:30 → 7h).
 * If the bed time is earlier in the day than the wake time, we assume both
 * are on the same morning (e.g., bed 01:00, wake 07:00 → 6h, pastMidnight=true).
 */
export function computeSleepMinutes(
  bedHour: number,
  bedMinute: number,
  wakeHour: number,
  wakeMinute: number,
): number {
  const bed = bedHour * 60 + bedMinute;
  const wake = wakeHour * 60 + wakeMinute;
  if (bed === wake) return 0;
  if (bed > wake) {
    // bed in evening, wake next morning
    return 24 * 60 - bed + wake;
  }
  // bed already past midnight (00:00–wakeTime range)
  return wake - bed;
}

/** True iff bed time is at or after 00:00 and before 12:00 (i.e., the AM hours). */
export function isPastMidnightBed(bedHour: number): boolean {
  return bedHour >= 0 && bedHour < 12;
}

/** True iff bed time is at or before 22:30. */
export function isEarlyBed(bedHour: number, bedMinute: number): boolean {
  // <= 22:30
  return bedHour < 22 || (bedHour === 22 && bedMinute <= 30);
}

const DANGER_MESSAGE =
  "운동과 식단을 아무리 열심히 해도 수면이 부족하면 반쪽짜리에요";

/**
 * Evaluate a sleep entry and produce a status + coach message.
 * Rules (per user request):
 *   - 5시간 미만 OR 자정 이후 취침 → "danger" + 위험 멘트
 *   - 그 외 → "neutral" + 빈 메시지
 *   ※ 칭찬 메시지는 의도적으로 제거되었다. 과수면(예: 20시간)도 칭찬되는 문제를 방지하고,
 *     "위험 신호일 때만 알려준다"는 정책으로 단순화한다.
 */
export function evaluateSleep(
  bedHour: number,
  bedMinute: number,
  wakeHour: number,
  wakeMinute: number,
): SleepEvaluation {
  const durationMinutes = computeSleepMinutes(bedHour, bedMinute, wakeHour, wakeMinute);
  const pastMidnight = isPastMidnightBed(bedHour);
  if (durationMinutes < 300 || pastMidnight) {
    return { durationMinutes, status: "danger", message: DANGER_MESSAGE, pastMidnight };
  }
  return { durationMinutes, status: "neutral", message: "", pastMidnight };
}

/**
 * Build a comment string for weight delta vs yesterday.
 * Returns empty string when there is no previous weight or delta is 0.
 * The exact wording is fixed per user request.
 */
export function weightDeltaComment(
  yesterdayKg: number | null | undefined,
  todayKg: number | null | undefined,
): { deltaG: number; message: string } {
  if (yesterdayKg == null || todayKg == null) return { deltaG: 0, message: "" };
  const deltaKg = todayKg - yesterdayKg; // negative = loss
  const deltaG = Math.round(deltaKg * 1000);
  if (deltaG === 0) return { deltaG: 0, message: "" };
  if (deltaG < 0) {
    const absG = Math.abs(deltaG);
    return {
      deltaG,
      message: `-${absG}g 삭제 성공. 오늘 이걸 망칠 순 없다!`,
    };
  }
  return {
    deltaG,
    message: `+${deltaG}g 지금은 다지는 중. 오늘 이걸 만회할 수 있다!`,
  };
}
