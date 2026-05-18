import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  appSettings,
  comments,
  exercises,
  goals,
  invitations,
  mealPhotos,
  meals,
  reactions,
  scheduledJobs,
  seasonParticipants,
  seasonPhotos,
  seasonReports,
  seasonTokens,
  seasons,
  sleeps,
  users,
  waistRecords,
  weights,
  type InsertComment,
  type InsertExercise,
  type InsertGoal,
  type InsertInvitation,
  type InsertMealPhoto,
  type InsertMeal,
  type InsertReaction,
  type InsertScheduledJob,
  type InsertSeason,
  type InsertSeasonParticipant,
  type InsertSeasonPhoto,
  type InsertSeasonReport,
  type InsertSleep,
  type InsertUser,
  type InsertWeight,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (_db) return _db;

  try {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) return null;
    const urlBase = rawUrl.split("?")[0];
    const parsed = new URL(urlBase);
    console.log("[DB] creating pool to", parsed.hostname, "...");
    const pool = mysql.createPool({
      host: parsed.hostname,
      port: parseInt(parsed.port || "4000"),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1),
      ssl: { rejectUnauthorized: false },
      connectTimeout: 15000,
      waitForConnections: true,
      connectionLimit: 5,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
    console.log("[DB] pool created!");
    _db = drizzle(pool);
    return _db;
  } catch (error) {
    console.error("[Database] Failed to create pool:", error);
    return null;
  }
}

async function db() {
  const conn = await getDb();
  if (!conn) throw new Error("Database not available");
  return conn;
}

/* -------- Users -------- */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const conn = await getDb();
  if (!conn) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "bio", "avatarUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (user.status !== undefined) {
      values.status = user.status;
      updateSet.status = user.status;
    } else if (user.openId === ENV.ownerOpenId) {
      values.status = "approved";
      updateSet.status = "approved";
    }
    if (user.invitedByUserId !== undefined) {
      values.invitedByUserId = user.invitedByUserId;
      updateSet.invitedByUserId = user.invitedByUserId;
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await conn.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const conn = await getDb();
  if (!conn) return undefined;
  const result = await conn.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const conn = await db();
  const result = await conn.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function listApprovedUsers() {
  const conn = await db();
  return conn.select().from(users).where(eq(users.status, "approved")).orderBy(asc(users.name));
}

export async function listAllUsers() {
  const conn = await db();
  return conn.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserStatus(userId: number, status: "pending" | "approved" | "rejected") {
  const conn = await db();
  await conn.update(users).set({ status }).where(eq(users.id, userId));
}

export async function setUserRole(userId: number, role: "user" | "admin") {
  const conn = await db();
  await conn.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserProfile(userId: number, profile: { name?: string; bio?: string | null; avatarUrl?: string | null }) {
  const conn = await db();
  const set: Record<string, unknown> = {};
  if (profile.name !== undefined) set.name = profile.name;
  if (profile.bio !== undefined) set.bio = profile.bio;
  if (profile.avatarUrl !== undefined) set.avatarUrl = profile.avatarUrl;
  if (Object.keys(set).length === 0) return;
  await conn.update(users).set(set).where(eq(users.id, userId));
}

/* -------- Invitations -------- */

export async function createInvitation(input: InsertInvitation) {
  const conn = await db();
  const result = await conn.insert(invitations).values(input);
  return result;
}

export async function getInvitationByToken(token: string) {
  const conn = await db();
  const rows = await conn.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return rows[0];
}

export async function listInvitations() {
  const conn = await db();
  return conn.select().from(invitations).orderBy(desc(invitations.createdAt));
}

export async function consumeInvitation(token: string, userId: number) {
  const conn = await db();
  await conn.update(invitations)
    .set({ usedByUserId: userId, usedAt: new Date() })
    .where(and(eq(invitations.token, token), sql`${invitations.usedByUserId} IS NULL`));
}

export async function deleteInvitation(id: number) {
  const conn = await db();
  await conn.delete(invitations).where(eq(invitations.id, id));
}

/* -------- Weights -------- */

export async function upsertWeight(input: InsertWeight) {
  const conn = await db();
  const existing = await conn.select().from(weights)
    .where(and(eq(weights.userId, input.userId), eq(weights.recordedDate, input.recordedDate)))
    .limit(1);
  if (existing[0]) {
    const update: Partial<InsertWeight> = {
      weightKg: input.weightKg,
      note: input.note ?? null,
    };
    if (input.skeletalMuscleKg !== undefined) update.skeletalMuscleKg = input.skeletalMuscleKg;
    if (input.bodyFatPercent !== undefined) update.bodyFatPercent = input.bodyFatPercent;
    if (input.inbodyPhotoKey !== undefined) update.inbodyPhotoKey = input.inbodyPhotoKey;
    if (input.inbodyPhotoUrl !== undefined) update.inbodyPhotoUrl = input.inbodyPhotoUrl;
    await conn.update(weights).set(update).where(eq(weights.id, existing[0].id));
    return existing[0].id;
  }
  const result = await conn.insert(weights).values(input);
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function listWeightsByUser(userId: number, sinceDate?: string) {
  const conn = await db();
  const conds = [eq(weights.userId, userId)];
  if (sinceDate) conds.push(gte(weights.recordedDate, sinceDate));
  return conn.select().from(weights).where(and(...conds)).orderBy(asc(weights.recordedDate));
}

export async function getWeightOnDate(userId: number, date: string) {
  const conn = await db();
  const rows = await conn.select().from(weights)
    .where(and(eq(weights.userId, userId), eq(weights.recordedDate, date)))
    .limit(1);
  return rows[0];
}

export async function listWeightsForUsersOnDate(userIds: number[], date: string) {
  if (userIds.length === 0) return [];
  const conn = await db();
  return conn.select().from(weights)
    .where(and(inArray(weights.userId, userIds), eq(weights.recordedDate, date)));
}

export async function getWeightByUserAndDate(userId: number, date: string) {
  const conn = await db();
  const rows = await conn.select().from(weights)
    .where(and(eq(weights.userId, userId), eq(weights.recordedDate, date)))
    .limit(1);
  return rows[0];
}

/* -------- Goals -------- */

export async function upsertGoal(input: InsertGoal) {
  const conn = await db();
  await conn.insert(goals).values(input).onDuplicateKeyUpdate({
    set: {
      startWeightKg: input.startWeightKg,
      targetWeightKg: input.targetWeightKg,
      targetDate: input.targetDate ?? null,
    },
  });
}

export async function getGoalByUser(userId: number) {
  const conn = await db();
  const rows = await conn.select().from(goals).where(eq(goals.userId, userId)).limit(1);
  return rows[0];
}

/* -------- Meals -------- */

export async function createMeal(input: InsertMeal) {
  const conn = await db();
  const result = await conn.insert(meals).values(input);
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function updateMeal(id: number, patch: Partial<InsertMeal>) {
  const conn = await db();
  await conn.update(meals).set(patch).where(eq(meals.id, id));
}

export async function setMealAiComment(id: number, aiComment: string) {
  const conn = await db();
  await conn.update(meals).set({ aiComment, aiCommentAt: new Date() }).where(eq(meals.id, id));
}

export async function getMealById(id: number) {
  const conn = await db();
  const rows = await conn.select().from(meals).where(eq(meals.id, id)).limit(1);
  return rows[0];
}

export async function deleteMeal(id: number) {
  const conn = await db();
  await conn.delete(meals).where(eq(meals.id, id));
  await conn.delete(mealPhotos).where(eq(mealPhotos.mealId, id));
}

export async function listMealsByUserDate(userId: number, date: string) {
  const conn = await db();
  return conn.select().from(meals)
    .where(and(eq(meals.userId, userId), eq(meals.recordedDate, date)))
    .orderBy(asc(meals.createdAt));
}

export async function listMealsForUsersOnDate(userIds: number[], date: string) {
  if (userIds.length === 0) return [];
  const conn = await db();
  return conn.select().from(meals)
    .where(and(inArray(meals.userId, userIds), eq(meals.recordedDate, date)))
    .orderBy(desc(meals.createdAt));
}

export async function listMealsByUserRange(userId: number, since: string, until: string) {
  const conn = await db();
  return conn.select().from(meals)
    .where(and(eq(meals.userId, userId), gte(meals.recordedDate, since), lte(meals.recordedDate, until)))
    .orderBy(asc(meals.recordedDate));
}

/* -------- Meal photos -------- */

export async function addMealPhoto(input: InsertMealPhoto) {
  const conn = await db();
  await conn.insert(mealPhotos).values(input);
}

export async function listMealPhotos(mealIds: number[]) {
  if (mealIds.length === 0) return [];
  const conn = await db();
  return conn.select().from(mealPhotos).where(inArray(mealPhotos.mealId, mealIds));
}

/* -------- Exercises -------- */

export async function createExercise(input: InsertExercise) {
  const conn = await db();
  const result = await conn.insert(exercises).values(input);
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function deleteExercise(id: number) {
  const conn = await db();
  await conn.delete(exercises).where(eq(exercises.id, id));
}

export async function listExercisesByUserDate(userId: number, date: string) {
  const conn = await db();
  return conn.select().from(exercises)
    .where(and(eq(exercises.userId, userId), eq(exercises.recordedDate, date)))
    .orderBy(asc(exercises.createdAt));
}

export async function listExercisesForUsersOnDate(userIds: number[], date: string) {
  if (userIds.length === 0) return [];
  const conn = await db();
  return conn.select().from(exercises)
    .where(and(inArray(exercises.userId, userIds), eq(exercises.recordedDate, date)))
    .orderBy(desc(exercises.createdAt));
}

export async function listExercisesByUserRange(userId: number, since: string, until: string) {
  const conn = await db();
  return conn.select().from(exercises)
    .where(and(eq(exercises.userId, userId), gte(exercises.recordedDate, since), lte(exercises.recordedDate, until)))
    .orderBy(asc(exercises.recordedDate));
}

/* -------- Reactions -------- */

export async function toggleReaction(input: InsertReaction) {
  const conn = await db();
  const existing = await conn.select().from(reactions)
    .where(and(
      eq(reactions.userId, input.userId),
      eq(reactions.targetType, input.targetType),
      eq(reactions.targetId, input.targetId),
      eq(reactions.emoji, input.emoji),
    )).limit(1);
  if (existing[0]) {
    await conn.delete(reactions).where(eq(reactions.id, existing[0].id));
    return { added: false };
  }
  await conn.insert(reactions).values(input);
  return { added: true };
}

export async function listReactionsForTargets(targetType: "meal" | "exercise" | "weight", targetIds: number[]) {
  if (targetIds.length === 0) return [];
  const conn = await db();
  return conn.select().from(reactions)
    .where(and(eq(reactions.targetType, targetType), inArray(reactions.targetId, targetIds)));
}

/* -------- Comments -------- */

export async function addComment(input: InsertComment) {
  const conn = await db();
  await conn.insert(comments).values(input);
}

export async function deleteComment(id: number) {
  const conn = await db();
  await conn.delete(comments).where(eq(comments.id, id));
}

export async function listCommentsForTargets(targetType: "meal" | "exercise" | "weight", targetIds: number[]) {
  if (targetIds.length === 0) return [];
  const conn = await db();
  return conn.select().from(comments)
    .where(and(eq(comments.targetType, targetType), inArray(comments.targetId, targetIds)))
    .orderBy(asc(comments.createdAt));
}

/* -------- Scheduled jobs -------- */

export async function upsertScheduledJob(input: InsertScheduledJob) {
  const conn = await db();
  await conn.insert(scheduledJobs).values(input).onDuplicateKeyUpdate({
    set: {
      scheduleCronTaskUid: input.scheduleCronTaskUid ?? null,
      cronExpression: input.cronExpression ?? null,
      description: input.description ?? null,
      enabled: input.enabled ?? true,
    },
  });
}

export async function getScheduledJobByKey(jobKey: string) {
  const conn = await db();
  const rows = await conn.select().from(scheduledJobs).where(eq(scheduledJobs.jobKey, jobKey)).limit(1);
  return rows[0];
}

export async function getScheduledJobByTaskUid(taskUid: string) {
  const conn = await db();
  const rows = await conn.select().from(scheduledJobs).where(eq(scheduledJobs.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function deleteScheduledJob(jobKey: string) {
  const conn = await db();
  await conn.delete(scheduledJobs).where(eq(scheduledJobs.jobKey, jobKey));
}


/* -------- Seasons -------- */

export async function createSeason(input: InsertSeason) {
  const conn = await db();
  const [res] = await conn.insert(seasons).values(input).$returningId();
  return res?.id;
}

export async function endSeason(seasonId: number) {
  const conn = await db();
  await conn.update(seasons).set({ status: "ended" }).where(eq(seasons.id, seasonId));
}

export async function getActiveSeason() {
  const conn = await db();
  const rows = await conn.select().from(seasons).where(eq(seasons.status, "active")).limit(1);
  return rows[0];
}

export async function getSeasonById(id: number) {
  const conn = await db();
  const rows = await conn.select().from(seasons).where(eq(seasons.id, id)).limit(1);
  return rows[0];
}

export async function listSeasons() {
  const conn = await db();
  return conn.select().from(seasons).orderBy(desc(seasons.startDate));
}

export async function ensureActiveSeasonAutoEnd(today: string) {
  // active 시즌의 endDate가 오늘보다 이전이면 자동 종료
  const conn = await db();
  const active = await getActiveSeason();
  if (active && active.endDate < today) {
    await conn.update(seasons).set({ status: "ended" }).where(eq(seasons.id, active.id));
    return null;
  }
  return active;
}

export async function getOrCreateParticipant(seasonId: number, userId: number) {
  const conn = await db();
  const rows = await conn.select().from(seasonParticipants)
    .where(and(eq(seasonParticipants.seasonId, seasonId), eq(seasonParticipants.userId, userId)))
    .limit(1);
  if (rows[0]) return rows[0];
  await conn.insert(seasonParticipants).values({ seasonId, userId });
  const after = await conn.select().from(seasonParticipants)
    .where(and(eq(seasonParticipants.seasonId, seasonId), eq(seasonParticipants.userId, userId)))
    .limit(1);
  return after[0];
}

export async function setParticipantBaseline(
  seasonId: number,
  userId: number,
  baselineWeightKg: string,
  baselineRecordedDate: string,
) {
  const conn = await db();
  await conn.update(seasonParticipants)
    .set({ baselineWeightKg, baselineRecordedDate })
    .where(and(eq(seasonParticipants.seasonId, seasonId), eq(seasonParticipants.userId, userId)));
}

export async function getParticipant(seasonId: number, userId: number) {
  const conn = await db();
  const rows = await conn.select().from(seasonParticipants)
    .where(and(eq(seasonParticipants.seasonId, seasonId), eq(seasonParticipants.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listParticipants(seasonId: number) {
  const conn = await db();
  return conn.select().from(seasonParticipants).where(eq(seasonParticipants.seasonId, seasonId));
}

/**
 * Count distinct days a user logged a weight within a season window.
 * Uses recordedDate distinct count.
 */
export async function countWeightDaysInRange(userId: number, since: string, until: string) {
  const conn = await db();
  const rows = await conn
    .select({ d: weights.recordedDate })
    .from(weights)
    .where(and(
      eq(weights.userId, userId),
      gte(weights.recordedDate, since),
      lte(weights.recordedDate, until),
    ));
  const set = new Set(rows.map(r => r.d));
  return set.size;
}

export async function countMealDaysInRange(userId: number, since: string, until: string) {
  const conn = await db();
  const rows = await conn
    .select({ d: meals.recordedDate })
    .from(meals)
    .where(and(
      eq(meals.userId, userId),
      gte(meals.recordedDate, since),
      lte(meals.recordedDate, until),
    ));
  const set = new Set(rows.map(r => r.d));
  return set.size;
}

export async function countExerciseDaysInRange(userId: number, since: string, until: string) {
  const conn = await db();
  const rows = await conn
    .select({ d: exercises.recordedDate })
    .from(exercises)
    .where(and(
      eq(exercises.userId, userId),
      gte(exercises.recordedDate, since),
      lte(exercises.recordedDate, until),
    ));
  const set = new Set(rows.map(r => r.d));
  return set.size;
}

export async function listWeightsByUserRange(userId: number, since: string, until: string) {
  const conn = await db();
  return conn.select().from(weights)
    .where(and(eq(weights.userId, userId), gte(weights.recordedDate, since), lte(weights.recordedDate, until)))
    .orderBy(asc(weights.recordedDate));
}

export async function listSleepsByUserRange(userId: number, since: string, until: string) {
  const conn = await db();
  return conn.select().from(sleeps)
    .where(and(eq(sleeps.userId, userId), gte(sleeps.recordedDate, since), lte(sleeps.recordedDate, until)))
    .orderBy(asc(sleeps.recordedDate));
}

/**
 * Get latest weight on or before `until` for a user (used for current loss% calculation).
 */
export async function getLatestWeightInRange(userId: number, since: string, until: string) {
  const conn = await db();
  const rows = await conn.select().from(weights)
    .where(and(
      eq(weights.userId, userId),
      gte(weights.recordedDate, since),
      lte(weights.recordedDate, until),
    ))
    .orderBy(desc(weights.recordedDate))
    .limit(1);
  return rows[0];
}

/**
 * Get earliest weight on or after `since` for a user (used as baseline if not set).
 */
export async function getEarliestWeightInRange(userId: number, since: string, until: string) {
  const conn = await db();
  const rows = await conn.select().from(weights)
    .where(and(
      eq(weights.userId, userId),
      gte(weights.recordedDate, since),
      lte(weights.recordedDate, until),
    ))
    .orderBy(asc(weights.recordedDate))
    .limit(1);
  return rows[0];
}


/* ============== Season photos ============== */

export async function listSeasonPhotos(seasonId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(seasonPhotos)
    .where(and(eq(seasonPhotos.seasonId, seasonId), eq(seasonPhotos.userId, userId)))
    .orderBy(seasonPhotos.createdAt);
}

export async function listSeasonPhotosBySlot(
  seasonId: number,
  userId: number,
  slot: "before" | "progress" | "after",
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(seasonPhotos)
    .where(
      and(
        eq(seasonPhotos.seasonId, seasonId),
        eq(seasonPhotos.userId, userId),
        eq(seasonPhotos.slot, slot),
      ),
    )
    .orderBy(seasonPhotos.createdAt);
}

export async function upsertSeasonPhoto(input: InsertSeasonPhoto) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // For before/after we keep a single photo per (slot, angle) by deleting then inserting.
  if (input.slot === "before" || input.slot === "after") {
    await db
      .delete(seasonPhotos)
      .where(
        and(
          eq(seasonPhotos.seasonId, input.seasonId),
          eq(seasonPhotos.userId, input.userId),
          eq(seasonPhotos.slot, input.slot),
          eq(seasonPhotos.angle, input.angle),
        ),
      );
  }
  await db.insert(seasonPhotos).values(input);
}

export async function deleteSeasonPhoto(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(seasonPhotos)
    .where(and(eq(seasonPhotos.id, id), eq(seasonPhotos.userId, userId)));
}

/* ============== Season reports ============== */

export async function getSeasonReport(seasonId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(seasonReports)
    .where(and(eq(seasonReports.seasonId, seasonId), eq(seasonReports.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function upsertSeasonReport(input: InsertSeasonReport) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await getSeasonReport(input.seasonId, input.userId);
  if (existing) {
    await db
      .update(seasonReports)
      .set({
        baselineWeightKg: input.baselineWeightKg ?? existing.baselineWeightKg,
        finalWeightKg: input.finalWeightKg ?? existing.finalWeightKg,
        lossPercent: input.lossPercent ?? existing.lossPercent,
        finalSkeletalMuscleKg: input.finalSkeletalMuscleKg ?? existing.finalSkeletalMuscleKg,
        finalBodyFatPercent: input.finalBodyFatPercent ?? existing.finalBodyFatPercent,
        weightCount: input.weightCount ?? existing.weightCount,
        mealCount: input.mealCount ?? existing.mealCount,
        exerciseCount: input.exerciseCount ?? existing.exerciseCount,
        totalCount: input.totalCount ?? existing.totalCount,
        participationScore: input.participationScore ?? existing.participationScore,
        completed: input.completed ?? existing.completed,
        reflection: input.reflection ?? existing.reflection,
        isPublic: input.isPublic ?? existing.isPublic,
      })
      .where(eq(seasonReports.id, existing.id));
    return existing.id;
  }
  const r: unknown = await db.insert(seasonReports).values(input);
  // mysql2 returns [ResultSetHeader, FieldPacket[]]; insertId is on the header.
  const header = Array.isArray(r) ? (r[0] as { insertId?: number }) : (r as { insertId?: number });
  return Number(header?.insertId ?? 0);
}

export async function updateSeasonReportReflection(
  seasonId: number,
  userId: number,
  reflection: string,
  isPublic: boolean,
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(seasonReports)
    .set({ reflection, isPublic })
    .where(and(eq(seasonReports.seasonId, seasonId), eq(seasonReports.userId, userId)));
}

export async function listSeasonReports(seasonId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(seasonReports)
    .where(eq(seasonReports.seasonId, seasonId))
    .orderBy(seasonReports.generatedAt);
}


/* -------- Sleeps -------- */

/**
 * 사용자별·기상일별 1행을 보장하는 upsert.
 * recordedDate 는 "기상한 날짜"(YYYY-MM-DD) 이며, bedAt/wakeAt 은 ISO datetime UTC.
 */
export async function upsertSleep(input: InsertSleep) {
  const conn = await db();
  const existing = await conn.select().from(sleeps)
    .where(and(eq(sleeps.userId, input.userId), eq(sleeps.recordedDate, input.recordedDate)))
    .limit(1);
  if (existing[0]) {
    await conn.update(sleeps).set({
      bedAt: input.bedAt,
      wakeAt: input.wakeAt,
      durationMinutes: input.durationMinutes,
      bedHour: input.bedHour,
      bedMinute: input.bedMinute,
      wakeHour: input.wakeHour,
      wakeMinute: input.wakeMinute,
    }).where(eq(sleeps.id, existing[0].id));
    return existing[0].id;
  }
  const result = await conn.insert(sleeps).values(input);
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function getSleepByDate(userId: number, recordedDate: string) {
  const conn = await db();
  const rows = await conn.select().from(sleeps)
    .where(and(eq(sleeps.userId, userId), eq(sleeps.recordedDate, recordedDate)))
    .limit(1);
  return rows[0];
}

export async function listSleepsByUser(userId: number, sinceDate?: string) {
  const conn = await db();
  const conds = [eq(sleeps.userId, userId)];
  if (sinceDate) conds.push(gte(sleeps.recordedDate, sinceDate));
  return conn.select().from(sleeps).where(and(...conds)).orderBy(asc(sleeps.recordedDate));
}


export async function countSleepDaysInRange(userId: number, since: string, until: string) {
  const conn = await db();
  const rows = await conn
    .select({ d: sleeps.recordedDate })
    .from(sleeps)
    .where(and(
      eq(sleeps.userId, userId),
      gte(sleeps.recordedDate, since),
      lte(sleeps.recordedDate, until),
    ));
  const set = new Set(rows.map(r => r.d));
  return set.size;
}


/* -------- Waters -------- */

import { waters, type InsertWater } from "../drizzle/schema";

export async function createWater(input: InsertWater) {
  const conn = await db();
  const result = await conn.insert(waters).values(input);
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function listWatersByDate(userId: number, date: string) {
  const conn = await db();
  return conn.select().from(waters)
    .where(and(eq(waters.userId, userId), eq(waters.recordedDate, date)))
    .orderBy(asc(waters.createdAt));
}

export async function listWatersByUserRange(userId: number, since: string, until: string) {
  const conn = await db();
  return conn.select().from(waters)
    .where(and(
      eq(waters.userId, userId),
      gte(waters.recordedDate, since),
      lte(waters.recordedDate, until),
    ))
    .orderBy(asc(waters.recordedDate));
}

export async function sumWaterMlByDate(userId: number, date: string): Promise<number> {
  const rows = await listWatersByDate(userId, date);
  return rows.reduce((acc, r) => acc + (r.volumeMl || 0), 0);
}

export async function countWatersInRange(userId: number, since: string, until: string): Promise<number> {
  const conn = await db();
  const rows = await conn.select({ id: waters.id })
    .from(waters)
    .where(and(
      eq(waters.userId, userId),
      gte(waters.recordedDate, since),
      lte(waters.recordedDate, until),
    ));
  return rows.length;
}

export async function getWaterById(id: number) {
  const conn = await db();
  const rows = await conn.select().from(waters).where(eq(waters.id, id)).limit(1);
  return rows[0];
}

export async function deleteWater(id: number) {
  const conn = await db();
  await conn.delete(waters).where(eq(waters.id, id));
}

/* -------- Season Tokens (시즌코드 활성화 기록) -------- */

export async function getSeasonToken(userId: number, seasonId: number) {
  const conn = await db();
  const rows = await conn.select().from(seasonTokens)
    .where(and(eq(seasonTokens.userId, userId), eq(seasonTokens.seasonId, seasonId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function grantSeasonToken(userId: number, seasonId: number): Promise<void> {
  const conn = await db();
  const existing = await getSeasonToken(userId, seasonId);
  if (!existing) {
    await conn.insert(seasonTokens).values({ userId, seasonId });
  }
}

export async function setSeasonCode(seasonId: number, code: string): Promise<void> {
  const conn = await db();
  await conn.update(seasons).set({ seasonCode: code }).where(eq(seasons.id, seasonId));
}

/* -------- App Settings (앱 전역 설정) -------- */

export async function getEntryCode(): Promise<string> {
  const conn = await db();
  const rows = await conn.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  return rows[0]?.entryCode ?? "";
}

export async function setEntryCode(code: string): Promise<void> {
  const conn = await db();
  const rows = await conn.select({ id: appSettings.id }).from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (rows[0]) {
    await conn.update(appSettings).set({ entryCode: code }).where(eq(appSettings.id, 1));
  } else {
    await conn.insert(appSettings).values({ id: 1, entryCode: code });
  }
}

/* -------- 온보딩 -------- */

export async function completeOnboarding(
  userId: number,
  data: { realName: string; phone: string; joinPurpose?: string; agreedToTerms: boolean },
): Promise<void> {
  const conn = await db();
  await conn.update(users).set({
    realName: data.realName,
    phone: data.phone,
    joinPurpose: data.joinPurpose ?? null,
    agreedToTerms: data.agreedToTerms,
    onboardingDone: true,
    status: "approved",
  }).where(eq(users.id, userId));
}

/* -------- 허리 둘레 기록 -------- */

export async function getWaistRecord(seasonId: number, userId: number) {
  const conn = await db();
  const rows = await conn.select().from(waistRecords)
    .where(and(eq(waistRecords.seasonId, seasonId), eq(waistRecords.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveWaistRecord(
  seasonId: number,
  userId: number,
  beforeCm: number | null,
  afterCm: number | null,
): Promise<void> {
  const conn = await db();
  const existing = await getWaistRecord(seasonId, userId);
  if (existing) {
    await conn.update(waistRecords)
      .set({
        beforeCm: beforeCm !== null ? beforeCm.toFixed(1) : null,
        afterCm: afterCm !== null ? afterCm.toFixed(1) : null,
      })
      .where(eq(waistRecords.id, existing.id));
  } else {
    await conn.insert(waistRecords).values({
      seasonId,
      userId,
      beforeCm: beforeCm !== null ? beforeCm.toFixed(1) : null,
      afterCm: afterCm !== null ? afterCm.toFixed(1) : null,
    });
  }
}

/* -------- 관리자 - 성함으로 멤버 검색 -------- */

export async function searchUsersByName(query: string) {
  const conn = await db();
  // realName 또는 name 에서 부분 검색
  const rows = await conn.select().from(users);
  const q = query.toLowerCase();
  return rows.filter(u =>
    (u.realName ?? "").toLowerCase().includes(q) ||
    (u.name ?? "").toLowerCase().includes(q) ||
    (u.email ?? "").toLowerCase().includes(q),
  );
}
