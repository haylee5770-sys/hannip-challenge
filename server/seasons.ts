import * as db from "./db";

/**
 * Compute Day index (1..N) from a season's start date and a target date.
 * Returns null if the date is outside the season window.
 */
export function dayNumber(startDate: string, endDate: string, target: string): number | null {
  if (target < startDate || target > endDate) return null;
  const start = new Date(startDate + "T00:00:00Z").getTime();
  const t = new Date(target + "T00:00:00Z").getTime();
  const diffDays = Math.floor((t - start) / 86400000);
  return diffDays + 1;
}

/** Total length in days, inclusive. */
export function totalDays(startDate: string, endDate: string): number {
  const s = new Date(startDate + "T00:00:00Z").getTime();
  const e = new Date(endDate + "T00:00:00Z").getTime();
  return Math.floor((e - s) / 86400000) + 1;
}

/** Add `days` to a YYYY-MM-DD string and return YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute loss percent given baseline and current weight.
 * Positive number = loss (weight went down).
 * Returns 0 when baseline missing or invalid.
 */
export function lossPercent(baseline: number | null | undefined, current: number | null | undefined): number {
  if (!baseline || !current || baseline <= 0) return 0;
  return ((baseline - current) / baseline) * 100;
}

/**
 * After a weight is upserted, ensure the user is enrolled in the active season
 * and baseline is set to the earliest weight inside the season window.
 */
export async function syncSeasonBaselineForUser(userId: number, recordedDate: string) {
  const active = await db.getActiveSeason();
  if (!active) return null;
  if (recordedDate < active.startDate || recordedDate > active.endDate) return null;
  await db.getOrCreateParticipant(active.id, userId);
  const earliest = await db.getEarliestWeightInRange(userId, active.startDate, active.endDate);
  if (earliest) {
    await db.setParticipantBaseline(
      active.id,
      userId,
      earliest.weightKg,
      earliest.recordedDate,
    );
  }
  return active;
}

export type CertificationCounts = {
  weight: number;
  meal: number;
  exercise: number;
  sleep: number;
  water: number;
  total: number;
};

export async function getMyCounts(seasonId: number, userId: number, since: string, until: string): Promise<CertificationCounts> {
  const [w, m, e, s, wa] = await Promise.all([
    db.countWeightDaysInRange(userId, since, until),
    db.countMealDaysInRange(userId, since, until),
    db.countExerciseDaysInRange(userId, since, until),
    db.countSleepDaysInRange(userId, since, until),
    db.countWatersInRange(userId, since, until),
  ]);
  return { weight: w, meal: m, exercise: e, sleep: s, water: wa, total: w + m + e + s + wa };
}

export type LeaderboardEntry = {
  userId: number;
  baselineWeightKg: number | null;
  currentWeightKg: number | null;
  lossPercent: number;
  lossKg: number | null;
};

/**
 * Compute leaderboard: each participant's loss% based on baseline vs. latest weight inside the window.
 * `until` is typically today (clamped to season end).
 */
export async function computeLeaderboard(seasonId: number, since: string, until: string): Promise<Map<number, LeaderboardEntry>> {
  const parts = await db.listParticipants(seasonId);
  const map = new Map<number, LeaderboardEntry>();
  await Promise.all(parts.map(async (p) => {
    const baseline = p.baselineWeightKg ? parseFloat(p.baselineWeightKg) : null;
    const latest = await db.getLatestWeightInRange(p.userId, since, until);
    const current = latest ? parseFloat(latest.weightKg) : null;
    map.set(p.userId, {
      userId: p.userId,
      baselineWeightKg: baseline,
      currentWeightKg: current,
      lossPercent: lossPercent(baseline, current),
      lossKg: baseline && current ? +(baseline - current).toFixed(2) : null,
    });
  }));
  return map;
}


/**
 * 시즌의 모든 참가자에 대해 결과 리포트(seasonReports)를 생성/갱신한다.
 * - 기존 reflection / isPublic 값은 보존한다.
 * - close/end 시점 또는 reveal 페이지 진입 시 호출되어 공개 리포트의 데이터 무결성을 보장한다.
 */
export async function generateSeasonReports(seasonId: number): Promise<number> {
  const season = await db.getSeasonById(seasonId);
  if (!season) return 0;
  const parts = await db.listParticipants(seasonId);
  const total = totalDays(season.startDate, season.endDate);
  let count = 0;
  for (const p of parts) {
    const counts = await getMyCounts(seasonId, p.userId, season.startDate, season.endDate);
    const baseline = p.baselineWeightKg ? parseFloat(p.baselineWeightKg) : null;
    const latest = await db.getLatestWeightInRange(p.userId, season.startDate, season.endDate);
    const finalWeight = latest ? parseFloat(latest.weightKg) : null;
    const finalSm = latest?.skeletalMuscleKg ? parseFloat(latest.skeletalMuscleKg) : null;
    const finalBf = latest?.bodyFatPercent ? parseFloat(latest.bodyFatPercent) : null;
    const lossPct = lossPercent(baseline, finalWeight);
    const completed = counts.weight >= total && counts.meal >= total && counts.exercise >= total;
    const score = counts.total + (completed ? total : 0);
    const existing = await db.getSeasonReport(seasonId, p.userId);
    await db.upsertSeasonReport({
      seasonId,
      userId: p.userId,
      baselineWeightKg: baseline?.toFixed(2),
      finalWeightKg: finalWeight?.toFixed(2),
      lossPercent: lossPct.toFixed(3),
      finalSkeletalMuscleKg: finalSm?.toFixed(2),
      finalBodyFatPercent: finalBf?.toFixed(2),
      weightCount: counts.weight,
      mealCount: counts.meal,
      exerciseCount: counts.exercise,
      sleepCount: counts.sleep,
      waterCount: counts.water,
      totalCount: counts.total,
      participationScore: score,
      completed,
      reflection: existing?.reflection ?? null,
      isPublic: existing?.isPublic ?? true,
    });
    count++;
  }
  return count;
}
