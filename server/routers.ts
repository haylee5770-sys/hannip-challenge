import { COOKIE_NAME, NOT_APPROVED_ERR_MSG } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  approvedProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { storagePut } from "./storage";
import { generateAutoFeedback } from "./feedback";
import { analyzeInbodyImage } from "./inbody";
import { analyzeMealImage } from "./mealVision";
import { getDailyLines } from "./dailyLines";
import * as rounds from "./rounds";
import * as wellness from "./wellness";
import * as entryCode from "./entryCode";
import * as roster from "./roster";
import * as sp from "./seasonPlus";


import { syncSeasonBaselineForUser, computeLeaderboard, getMyCounts, dayNumber, totalDays, generateSeasonReports } from "./seasons";
import { evaluateSleep, computeSleepMinutes } from "./sleep";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { parse as parseCookie } from "cookie";
import { sql as sqlTag } from "drizzle-orm";

/** 모든 시즌 공통 입장코드 (2026-11-20 방장 지정). 대소문자·띄어쓰기 무시. Railway 변수 ENTRY_CODE로 바꿀 수 있음 */
export const COMMON_ENTRY_CODE = (process.env.ENTRY_CODE || "SUPERHAPPY2027").trim();
const normCode = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "").toLowerCase();
function entryCodeMatches(input: string, seasonCode?: string | null): boolean {
  const v = normCode(input);
  if (!v) return false;
  if (v === normCode(COMMON_ENTRY_CODE)) return true;
  return !!normCode(seasonCode) && v === normCode(seasonCode);
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format required");

const TARGET_TYPES = ["meal", "exercise", "weight"] as const;

/* ----------------- Invitations ----------------- */
const invitationsRouter = router({
  list: adminProcedure.query(async () => db.listInvitations()),

  create: adminProcedure
    .input(z.object({ note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
        .replace(/-/g, "")
        .slice(0, 32);
      await db.createInvitation({
        token,
        createdByUserId: ctx.user.id,
        note: input.note ?? null,
      });
      return { token };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInvitation(input.id);
      return { ok: true };
    }),

  redeem: protectedProcedure
    .input(z.object({ token: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const invite = await db.getInvitationByToken(input.token);
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "유효하지 않은 초대 토큰입니다." });
      }
      if (invite.usedByUserId && invite.usedByUserId !== ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "이미 사용된 초대 토큰입니다." });
      }
      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "만료된 초대 토큰입니다." });
      }
      await db.upsertUser({
        openId: ctx.user.openId,
        status: "approved",
        invitedByUserId: invite.createdByUserId,
      });
      await db.consumeInvitation(input.token, ctx.user.id);
      return { ok: true };
    }),
});

/* ----------------- Members ----------------- */
const membersRouter = router({
  /** 선물 받을 곳 (2026-11-22): 내 전화번호·주소 보기/고치기 */
  myContact: protectedProcedure.query(async ({ ctx }) => roster.getMyContact(ctx.user.id)),
  updateContact: protectedProcedure
    .input(z.object({ phone: z.string().min(9).max(32), address: z.string().min(5).max(300) }))
    .mutation(async ({ ctx, input }) => { await roster.updateMyContact(ctx.user.id, { phone: input.phone.trim(), address: input.address.trim() }); return { ok: true }; }),
  list: approvedProcedure.query(async () => {
    const users = await db.listApprovedUsers();
    return users.map(u => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      role: u.role,
    }));
  }),

  /** 활동명 중복·비슷한 이름 검사 (수지 ↔ 배수지도 막음) */
  checkName: protectedProcedure
    .input(z.object({ name: z.string().max(64) }))
    .query(async ({ ctx, input }) => rounds.checkNickname(input.name, ctx.user.id)),

  /** 활동명 바꾸기 (검사 통과해야 저장) */
  setNickname: protectedProcedure
    .input(z.object({ name: z.string().min(2).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const r = await rounds.checkNickname(input.name, ctx.user.id);
      if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: `${r.reason} (${r.similar.join(", ")})` });
      await db.updateUserProfile(ctx.user.id, { name: input.name.trim() });
      return { ok: true };
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(64).optional(),
      bio: z.string().max(500).nullable().optional(),
      avatarUrl: z.string().max(2048).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUserProfile(ctx.user.id, input);
      return { ok: true };
    }),
});

/* ----------------- Weights ----------------- */
const weightsRouter = router({
  upsert: approvedProcedure
    .input(z.object({
      recordedDate: dateString,
      weightKg: z.number().min(20).max(400),
      skeletalMuscleKg: z.number().min(5).max(80).nullable().optional(),
      bodyFatPercent: z.number().min(1).max(70).nullable().optional(),
      inbodyPhotoBase64: z.string().optional(),
      note: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let inbodyPhotoKey: string | undefined;
      let inbodyPhotoUrl: string | undefined;

      if (input.inbodyPhotoBase64) {
        const matches = input.inbodyPhotoBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!matches) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "이미지 데이터 형식이 올바르지 않아요." });
        }
        const mime = matches[1];
        const ext = mime.split("/")[1].replace("+xml", "");
        const buf = Buffer.from(matches[2], "base64");
        const key = `inbody/${ctx.user.id}/${input.recordedDate}_${Date.now()}.${ext}`;
        const { key: storedKey, url } = await storagePut(key, buf, mime);
        inbodyPhotoKey = storedKey;
        inbodyPhotoUrl = url;
      }

      // 테이터 무결성: 인바디 수치(골격근량/체지방률)을 입력하는 경우,
      // 반드시 인바디 사진이 함께 적관 (신규 업로드 또는 기존 저장된 사진) 되어 있어야 합니다.
      const hasInbodyMetric =
        (input.skeletalMuscleKg !== undefined && input.skeletalMuscleKg !== null) ||
        (input.bodyFatPercent !== undefined && input.bodyFatPercent !== null);
      if (hasInbodyMetric && !inbodyPhotoUrl) {
        const existing = await db.getWeightByUserAndDate(ctx.user.id, input.recordedDate);
        if (!existing?.inbodyPhotoUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "골격근량 또는 체지방률을 기록하려면 인바디 사진을 함께 올려주세요.",
          });
        }
      }

      await db.upsertWeight({
        userId: ctx.user.id,
        recordedDate: input.recordedDate,
        weightKg: input.weightKg.toFixed(2),
        skeletalMuscleKg:
          input.skeletalMuscleKg !== undefined && input.skeletalMuscleKg !== null
            ? input.skeletalMuscleKg.toFixed(2)
            : (input.skeletalMuscleKg as null | undefined),
        bodyFatPercent:
          input.bodyFatPercent !== undefined && input.bodyFatPercent !== null
            ? input.bodyFatPercent.toFixed(2)
            : (input.bodyFatPercent as null | undefined),
        inbodyPhotoKey: inbodyPhotoKey,
        inbodyPhotoUrl: inbodyPhotoUrl,
        note: input.note ?? null,
      });
      // 활성 시즌에 스몀서 등록 및 베이스라인 동기화
      try {
        await syncSeasonBaselineForUser(ctx.user.id, input.recordedDate);
      } catch (e) {
        console.warn("[Season sync failed]", e);
      }
      return { ok: true, inbodyPhotoUrl };
    }),

  analyzeInbody: approvedProcedure
    .input(z.object({
      photoBase64: z.string().min(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const matches = input.photoBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!matches) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "이미지 데이터 형식이 올바르지 않아요." });
      }
      const mime = matches[1];
      const ext = mime.split("/")[1].replace("+xml", "");
      const buf = Buffer.from(matches[2], "base64");
      const key = `inbody-tmp/${ctx.user.id}/${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buf, mime);
      const result = await analyzeInbodyImage(url);
      return {
        weightKg: result.weightKg,
        skeletalMuscleKg: result.skeletalMuscleKg,
        bodyFatPercent: result.bodyFatPercent,
      };
    }),

  myHistory: approvedProcedure
    .input(z.object({ sinceDate: dateString.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await db.listWeightsByUser(ctx.user.id, input?.sinceDate);
      return rows.map(r => ({
        id: r.id,
        recordedDate: r.recordedDate,
        weightKg: Number(r.weightKg),
        skeletalMuscleKg: r.skeletalMuscleKg !== null && r.skeletalMuscleKg !== undefined ? Number(r.skeletalMuscleKg) : null,
        bodyFatPercent: r.bodyFatPercent !== null && r.bodyFatPercent !== undefined ? Number(r.bodyFatPercent) : null,
        inbodyPhotoUrl: r.inbodyPhotoUrl,
        note: r.note,
      }));
    }),

  byUser: approvedProcedure
    .input(z.object({ userId: z.number(), sinceDate: dateString.optional() }))
    .query(async ({ input }) => {
      const rows = await db.listWeightsByUser(input.userId, input.sinceDate);
      return rows.map(r => ({
        id: r.id,
        userId: r.userId,
        recordedDate: r.recordedDate,
        weightKg: Number(r.weightKg),
        skeletalMuscleKg: r.skeletalMuscleKg !== null && r.skeletalMuscleKg !== undefined ? Number(r.skeletalMuscleKg) : null,
        bodyFatPercent: r.bodyFatPercent !== null && r.bodyFatPercent !== undefined ? Number(r.bodyFatPercent) : null,
        inbodyPhotoUrl: r.inbodyPhotoUrl,
      }));
    }),

  todayForMembers: approvedProcedure
    .input(z.object({ date: dateString }))
    .query(async ({ input }) => {
      const users = await db.listApprovedUsers();
      const ids = users.map(u => u.id);
      const rows = await db.listWeightsForUsersOnDate(ids, input.date);
      return rows.map(r => ({
        id: r.id,
        userId: r.userId,
        weightKg: Number(r.weightKg),
        skeletalMuscleKg: r.skeletalMuscleKg !== null && r.skeletalMuscleKg !== undefined ? Number(r.skeletalMuscleKg) : null,
        bodyFatPercent: r.bodyFatPercent !== null && r.bodyFatPercent !== undefined ? Number(r.bodyFatPercent) : null,
        inbodyPhotoUrl: r.inbodyPhotoUrl,
        note: r.note,
      }));
    }),
});

/* ----------------- Goals ----------------- */
const goalsRouter = router({
  upsert: approvedProcedure
    .input(z.object({
      startWeightKg: z.number().min(20).max(400),
      targetWeightKg: z.number().min(20).max(400),
      targetDate: dateString.nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertGoal({
        userId: ctx.user.id,
        startWeightKg: input.startWeightKg.toFixed(2),
        targetWeightKg: input.targetWeightKg.toFixed(2),
        targetDate: input.targetDate ?? null,
      });
      return { ok: true };
    }),

  mine: approvedProcedure.query(async ({ ctx }) => {
    const g = await db.getGoalByUser(ctx.user.id);
    if (!g) return null;
    return {
      startWeightKg: Number(g.startWeightKg),
      targetWeightKg: Number(g.targetWeightKg),
      targetDate: g.targetDate,
    };
  }),
});

/* ----------------- Meals ----------------- */
const mealCategorySchema = z.enum(["breakfast", "lunch", "dinner", "snack", "regular", "smoothie"]);

const mealsRouter = router({
  create: approvedProcedure
    .input(z.object({
      recordedDate: dateString,
      category: mealCategorySchema,
      description: z.string().max(2000).optional(),
      carbsG: z.number().int().min(0).max(2000).default(0),
      proteinG: z.number().int().min(0).max(2000).default(0),
      fatG: z.number().int().min(0).max(2000).default(0),
      vegetableG: z.number().int().min(0).max(2000).default(0),
      waterMl: z.number().int().min(0).max(10000).default(0),
      photoBase64: z.array(z.string()).max(8).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      lockGuard(ctx.user, input.recordedDate);
      const mealId = await db.createMeal({
        userId: ctx.user.id,
        recordedDate: input.recordedDate,
        category: input.category,
        description: input.description ?? null,
        carbsG: input.carbsG,
        proteinG: input.proteinG,
        fatG: input.fatG,
        vegetableG: input.vegetableG,
        waterMl: input.waterMl,
      });

      // Upload photos
      if (input.photoBase64?.length) {
        for (let i = 0; i < input.photoBase64.length; i++) {
          const base64 = input.photoBase64[i];
          const matches = base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (!matches) continue;
          const mime = matches[1];
          const ext = mime.split("/")[1].replace("+xml", "");
          const buf = Buffer.from(matches[2], "base64");
          const key = `meals/${ctx.user.id}/${mealId}_${i}.${ext}`;
          try {
            const { key: storedKey, url } = await storagePut(key, buf, mime);
            await db.addMealPhoto({ mealId, userId: ctx.user.id, storageKey: storedKey, url });
          } catch (e) {
            console.warn("[Meal photo upload failed]", e);
          }
        }
      }

      // Trigger AI comment in background (don't block)
      generateMealAiComment(mealId).catch(e => console.warn("[AI comment failed]", e));

      return { id: mealId };
    }),

  /** 식단 사진 AI 분석: 무엇을 먹었는지 + 탄·단·지·채소 대략값 (2026-11-20) */
  analyzePhoto: approvedProcedure
    .input(z.object({ photoBase64: z.array(z.string().min(20)).min(1).max(4) }))
    .mutation(async ({ ctx, input }) => {
      const urls: string[] = [];
      for (let i = 0; i < input.photoBase64.length; i++) {
        const m = input.photoBase64[i].match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!m) continue;
        const ext = m[1].split("/")[1].replace("+xml", "");
        const { url } = await storagePut(`meal-ai-tmp/${ctx.user.id}/${Date.now()}_${i}.${ext}`, Buffer.from(m[2], "base64"), m[1]);
        urls.push(url);
      }
      if (!urls.length) throw new TRPCError({ code: "BAD_REQUEST", message: "사진 형식이 올바르지 않아요." });
      return analyzeMealImage(urls);
    }),

  delete: approvedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const meal = await db.getMealById(input.id);
      if (!meal) return { ok: false };
      if (meal.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다." });
      }
      lockGuard(ctx.user, String(meal.recordedDate).slice(0, 10));
      await db.deleteMeal(input.id);
      return { ok: true };
    }),

  byMeDate: approvedProcedure
    .input(z.object({ date: dateString }))
    .query(async ({ ctx, input }) => {
      const list = await db.listMealsByUserDate(ctx.user.id, input.date);
      const photos = await db.listMealPhotos(list.map(m => m.id));
      return list.map(m => ({
        ...m,
        photos: photos.filter(p => p.mealId === m.id),
      }));
    }),

  byUserRange: approvedProcedure
    .input(z.object({ userId: z.number(), since: dateString, until: dateString }))
    .query(async ({ input }) => db.listMealsByUserRange(input.userId, input.since, input.until)),

  feedback: approvedProcedure
    .input(z.object({
      carbsG: z.number().int().min(0),
      proteinG: z.number().int().min(0),
      fatG: z.number().int().min(0),
      vegetableG: z.number().int().min(0),
      waterMl: z.number().int().min(0),
      mealsToday: z.array(z.object({
        category: mealCategorySchema,
        carbsG: z.number().int(),
        proteinG: z.number().int(),
        fatG: z.number().int(),
        vegetableG: z.number().int(),
        waterMl: z.number().int(),
      })).optional(),
    }))
    .query(async ({ input }) => generateAutoFeedback(input)),

  regenerateAiComment: approvedProcedure
    .input(z.object({ mealId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const meal = await db.getMealById(input.mealId);
      if (!meal) throw new TRPCError({ code: "NOT_FOUND", message: "Meal not found" });
      if (meal.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다." });
      }
      await generateMealAiComment(input.mealId);
      const updated = await db.getMealById(input.mealId);
      return { aiComment: updated?.aiComment ?? null };
    }),
});

async function generateMealAiComment(mealId: number) {
  const meal = await db.getMealById(mealId);
  if (!meal) return;
  const prompt = `당신은 따뜻한 영양 코치입니다. 한국어 존댓말로 간결하게 2~3문장으로 답하세요.

식사 카테고리: ${categoryKo(meal.category)}
사용자 메모: ${meal.description ?? "(없음)"}
영양 입력값:
- 탄수화물: ${meal.carbsG}g
- 단백질: ${meal.proteinG}g
- 지방: ${meal.fatG}g
- 야채: ${meal.vegetableG}g
- 수분: ${meal.waterMl}ml

위 정보를 바탕으로 영양 균형, 칼로리 추정, 개선 제안을 따뜻하고 격려하는 톤으로 코멘트해 주세요.
이모지는 1~2개 정도만, 정중하고 우아하게.`;

  const result = await invokeLLM({
    messages: [
      { role: "system", content: "당신은 친절하고 우아한 영양 코치입니다." },
      { role: "user", content: prompt },
    ],
  });
  const text = (result.choices?.[0]?.message?.content ?? "") as string;
  if (typeof text === "string" && text.trim()) {
    await db.setMealAiComment(mealId, text.trim());
  }
}

function categoryKo(c: string) {
  return ({
    breakfast: "아침",
    lunch: "점심",
    dinner: "저녁",
    snack: "간식",
    regular: "일반식",
    smoothie: "스무디",
  } as Record<string, string>)[c] || c;
}

/* ----------------- Exercises ----------------- */
const exercisesRouter = router({
  create: approvedProcedure
    .input(z.object({
      recordedDate: dateString,
      kind: z.string().min(1).max(64),
      durationMin: z.number().int().min(1).max(1440),
      intensity: z.enum(["low", "medium", "high"]).default("medium"),
      note: z.string().max(500).optional(),
      photoBase64: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let photoKey: string | undefined;
      let photoUrl: string | undefined;

      if (input.photoBase64) {
        const matches = input.photoBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!matches) throw new TRPCError({ code: "BAD_REQUEST", message: "이미지 데이터 형식이 올바르지 않아요." });
        const mime = matches[1];
        const ext = mime.split("/")[1].replace("+xml", "");
        const buf = Buffer.from(matches[2], "base64");
        const key = `exercise/${ctx.user.id}/${input.recordedDate}_${Date.now()}.${ext}`;
        const stored = await storagePut(key, buf, mime);
        photoKey = stored.key;
        photoUrl = stored.url;
      }

      const id = await db.createExercise({
        userId: ctx.user.id,
        recordedDate: input.recordedDate,
        kind: input.kind,
        durationMin: input.durationMin,
        intensity: input.intensity,
        note: input.note ?? null,
        photoKey: photoKey ?? null,
        photoUrl: photoUrl ?? null,
      });
      return { id };
    }),

  delete: approvedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ex = await db.getExerciseById(input.id);
      if (!ex) return { ok: false };
      if (ex.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다." });
      lockGuard(ctx.user, String(ex.recordedDate).slice(0, 10));
      await db.deleteExercise(input.id);
      return { ok: true };
    }),

  byMeDate: approvedProcedure
    .input(z.object({ date: dateString }))
    .query(async ({ ctx, input }) => db.listExercisesByUserDate(ctx.user.id, input.date)),

  byUserRange: approvedProcedure
    .input(z.object({ userId: z.number(), since: dateString, until: dateString }))
    .query(async ({ input }) => db.listExercisesByUserRange(input.userId, input.since, input.until)),
});

/* ----------------- Feed ----------------- */
const feedRouter = router({
  today: approvedProcedure
    .input(z.object({ date: dateString }))
    .query(async ({ input }) => {
      const users = await db.listApprovedUsers();
      const ids = users.map(u => u.id);
      const [meals, exercises, weights] = await Promise.all([
        db.listMealsForUsersOnDate(ids, input.date),
        db.listExercisesForUsersOnDate(ids, input.date),
        db.listWeightsForUsersOnDate(ids, input.date),
      ]);
      const photos = await db.listMealPhotos(meals.map(m => m.id));
      const mealIds = meals.map(m => m.id);
      const exIds = exercises.map(e => e.id);
      const wIds = weights.map(w => w.id);
      const [reactM, reactE, reactW, comM, comE, comW] = await Promise.all([
        db.listReactionsForTargets("meal", mealIds),
        db.listReactionsForTargets("exercise", exIds),
        db.listReactionsForTargets("weight", wIds),
        db.listCommentsForTargets("meal", mealIds),
        db.listCommentsForTargets("exercise", exIds),
        db.listCommentsForTargets("weight", wIds),
      ]);
      return {
        users: users.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl })),
        meals: meals.map(m => ({
          ...m,
          photos: photos.filter(p => p.mealId === m.id),
        })),
        exercises,
        weights: weights.map(w => ({
          ...w,
          weightKg: Number(w.weightKg),
          skeletalMuscleKg: w.skeletalMuscleKg !== null && w.skeletalMuscleKg !== undefined ? Number(w.skeletalMuscleKg) : null,
          bodyFatPercent: w.bodyFatPercent !== null && w.bodyFatPercent !== undefined ? Number(w.bodyFatPercent) : null,
        })),
        reactions: {
          meal: reactM,
          exercise: reactE,
          weight: reactW,
        },
        comments: {
          meal: comM,
          exercise: comE,
          weight: comW,
        },
      };
    }),
});

/* ----------------- Reactions / Comments ----------------- */
const reactionsRouter = router({
  toggle: approvedProcedure
    .input(z.object({
      targetType: z.enum(TARGET_TYPES),
      targetId: z.number(),
      emoji: z.string().min(1).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.toggleReaction({
        userId: ctx.user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        emoji: input.emoji,
      });
    }),
});

const commentsRouter = router({
  add: approvedProcedure
    .input(z.object({
      targetType: z.enum(TARGET_TYPES),
      targetId: z.number(),
      body: z.string().min(1).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.addComment({
        userId: ctx.user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        body: input.body,
      });
      return { ok: true };
    }),

  delete: approvedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteComment(input.id);
      return { ok: true };
    }),
});

/* ----------------- Admin ----------------- */
const adminRouter = router({
  listUsers: adminProcedure.query(async () => db.listAllUsers()),

  setStatus: adminProcedure
    .input(z.object({
      userId: z.number(),
      status: z.enum(["pending", "approved", "rejected"]),
    }))
    .mutation(async ({ input }) => {
      await db.updateUserStatus(input.userId, input.status);
      return { ok: true };
    }),

  setRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["user", "admin"]),
    }))
    .mutation(async ({ input }) => {
      await db.setUserRole(input.userId, input.role);
      return { ok: true };
    }),

  listSchedules: adminProcedure.query(async () => {
    return [
      await db.getScheduledJobByKey("dailyReminder.morning"),
      await db.getScheduledJobByKey("dailyReminder.evening"),
    ].filter(Boolean);
  }),

  upsertReminder: adminProcedure
    .input(z.object({
      slot: z.enum(["morning", "evening"]),
      cron: z.string().min(9).max(64),
      enabled: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED" });
      const jobKey = `dailyReminder.${input.slot}`;
      const existing = await db.getScheduledJobByKey(jobKey);
      const description = `Daily ${input.slot} reminder fan-out—${input.slot === "morning" ? "morning" : "evening"} slot`;
      if (existing?.scheduleCronTaskUid) {
        await updateHeartbeatJob(
          existing.scheduleCronTaskUid,
          {
            cron: input.cron,
            path: "/api/scheduled/dailyReminder",
            payload: { slot: input.slot },
            description,
            enable: input.enabled,
          },
          sessionToken,
        );
        await db.upsertScheduledJob({
          jobKey,
          scheduleCronTaskUid: existing.scheduleCronTaskUid,
          cronExpression: input.cron,
          description,
          enabled: input.enabled,
        });
        return { taskUid: existing.scheduleCronTaskUid };
      }
      const job = await createHeartbeatJob({
        name: `${jobKey}-${Date.now()}`,
        cron: input.cron,
        path: "/api/scheduled/dailyReminder",
        payload: { slot: input.slot },
        description,
      }, sessionToken);
      await db.upsertScheduledJob({
        jobKey,
        scheduleCronTaskUid: job.taskUid,
        cronExpression: input.cron,
        description,
        enabled: input.enabled,
      });
      return { taskUid: job.taskUid };
    }),

  deleteReminder: adminProcedure
    .input(z.object({ slot: z.enum(["morning", "evening"]) }))
    .mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const jobKey = `dailyReminder.${input.slot}`;
      const existing = await db.getScheduledJobByKey(jobKey);
      if (existing?.scheduleCronTaskUid && sessionToken) {
        try { await deleteHeartbeatJob(existing.scheduleCronTaskUid, sessionToken); } catch { /* ignore */ }
      }
      await db.deleteScheduledJob(jobKey);
      return { ok: true };
    }),

  dailyReport: adminProcedure
    .input(z.object({ date: dateString }))
    .query(async ({ input }) => {
      const users = await db.listApprovedUsers();
      const ids = users.map(u => u.id);
      const [meals, exercises, weights] = await Promise.all([
        db.listMealsForUsersOnDate(ids, input.date),
        db.listExercisesForUsersOnDate(ids, input.date),
        db.listWeightsForUsersOnDate(ids, input.date),
      ]);
      const mealsByUser = new Set(meals.map(m => m.userId));
      const exByUser = new Set(exercises.map(e => e.userId));
      const wByUser = new Set(weights.map(w => w.userId));
      const report = users.map(u => {
        const missing: string[] = [];
        if (!wByUser.has(u.id)) missing.push("체중 미입력");
        if (!mealsByUser.has(u.id)) missing.push("식단 공유 안 함");
        if (!exByUser.has(u.id)) missing.push("운동 안 함");
        return {
          userId: u.id,
          name: u.name || u.email?.split("@")[0] || "이름 없음",
          missing,
          completed: missing.length === 0,
        };
      });
      return report;
    }),

  /** 시즌코드 설정 */
  setSeasonCode: adminProcedure
    .input(z.object({ seasonId: z.number(), code: z.string().max(64) }))
    .mutation(async ({ input }) => {
      await db.setSeasonCode(input.seasonId, input.code.trim());
      return { ok: true };
    }),

  /** 방장 메모 (2026-11-22) */
  notesFor: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => roster.listAdminNotes(input.userId)),
  addNote: adminProcedure.input(z.object({ userId: z.number(), text: z.string().min(1).max(2000) })).mutation(async ({ input }) => { await roster.addAdminNote(input.userId, input.text.trim()); return { ok: true }; }),
  deleteNote: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await roster.deleteAdminNote(input.id); return { ok: true }; }),
  /** 가입을 처음부터 다시 하게 (2026-11-22: 예전에 거절됐던 계정·시험용) */
  resetSignup: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
    const conn = await db.getDb(); if (conn) await conn.execute(sqlTag`UPDATE users SET status='pending', onboardingDone=false WHERE id=${input.userId}`);
    return { ok: true };
  }),
  /** 크루 명단 (2026-11-22) */
  rosterList: adminProcedure.query(async () => roster.listRoster()),
  rosterImport: adminProcedure.input(z.object({ text: z.string().min(1).max(200000) })).mutation(async ({ input }) => roster.importRoster(input.text)),
  rosterDelete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await roster.deleteRoster(input.id); return { ok: true }; }),
  userExtras: adminProcedure.query(async () => {
    const all = await db.listAllUsers();
    const m = await roster.getUserExtras(all.map(u => u.id));
    return Object.fromEntries(Array.from(m.entries()));
  }),

  /** 성함·이메일로 멤버 검색 */
  searchMembers: adminProcedure
    .input(z.object({ query: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const results = await db.searchUsersByName(input.query);
      return results.map(u => ({
        id: u.id,
        name: u.name,
        realName: u.realName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        loginMethod: u.loginMethod,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
        joinPurpose: u.joinPurpose,
        onboardingDone: u.onboardingDone,
      }));
    }),
});

/* ----------------- Seasons ----------------- */
const seasonsRouter = router({
  current: approvedProcedure.query(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const active = await db.ensureActiveSeasonAutoEnd(today);
    return active ?? null;
  }),

  list: approvedProcedure.query(async () => db.listSeasons()),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      startDate: dateString,
      totalDays: z.number().int().min(2).max(365).default(13),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // 챌린지 길이(기본 13일) → 종료일 = 시작일 + (totalDays-1)
        const endDate = (() => {
          const d = new Date(input.startDate + "T00:00:00Z");
          d.setUTCDate(d.getUTCDate() + (input.totalDays - 1));
          return d.toISOString().slice(0, 10);
        })();
        // 현재 진행 중인 시즌이 있으면 자동 종료
        const active = await db.getActiveSeason();
        if (active) await db.endSeason(active.id);
        // 다음 기수 자동 부여 (공백 회피는 하지 않고 기존 최대+1)
        const all = await db.listSeasons();
        const nextNumber = all.reduce((max, s) => Math.max(max, s.seasonNumber ?? 0), 0) + 1;
        console.log("[seasons.create] inserting season", { name: input.name, startDate: input.startDate, endDate, seasonNumber: nextNumber, userId: ctx.user.id });
        const id = await db.createSeason({
          seasonNumber: nextNumber,
          totalDays: input.totalDays,
          name: input.name,
          startDate: input.startDate,
          endDate,
          status: "active",
          createdByUserId: ctx.user.id,
        });
        console.log("[seasons.create] done, id=", id);
        return { id, endDate, seasonNumber: nextNumber };
      } catch (e) {
        console.error("[seasons.create] ERROR:", e);
        throw e;
      }
    }),

  close: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.endSeason(input.id);
      // 종료 시 모든 참가자의 리포트를 한 번에 생성/갱신한다 (reflection/isPublic 은 보존).
      try {
        await generateSeasonReports(input.id);
      } catch (e) {
        console.warn("[generateSeasonReports on close failed]", e);
      }
      return { ok: true };
    }),

  /** 어드민 전용 — 시즌 이름/기수/날짜 수정 */
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(128).optional(),
      seasonNumber: z.number().int().min(1).optional(),
      totalDays: z.number().int().min(2).max(365).optional(),
      startDate: dateString.optional(),
      endDate: dateString.optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await db.updateSeason(id, patch);
      return { ok: true };
    }),

  /**
   * 내 시즌 진행 상황: Day N, 내 카테고리별 인증 수, 내 감량 %.
   * 시즌이 없으면 null.
   */
  myProgress: approvedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    const active = await db.ensureActiveSeasonAutoEnd(today);
    if (!active) return null;
    const until = today < active.endDate ? today : active.endDate;
    const counts = await getMyCounts(active.id, ctx.user.id, active.startDate, until);
    const part = await db.getParticipant(active.id, ctx.user.id);
    const baseline = part?.baselineWeightKg ? parseFloat(part.baselineWeightKg) : null;
    const latest = await db.getLatestWeightInRange(ctx.user.id, active.startDate, until);
    const current = latest ? parseFloat(latest.weightKg) : null;
    const lossPct = baseline && current && baseline > 0 ? ((baseline - current) / baseline) * 100 : 0;
    const day = dayNumber(active.startDate, active.endDate, today);
    return {
      season: active,
      dayNumber: day,
      totalDays: totalDays(active.startDate, active.endDate),
      counts,
      baselineWeightKg: baseline,
      currentWeightKg: current,
      lossPercent: lossPct,
      lossKg: baseline && current ? +(baseline - current).toFixed(2) : null,
    };
  }),

  /** 연속 인증 스트릭: 오늘까지 연속으로 하루 이상 기록(체중 or 식단 or 운동)한 일수 */
  myStreak: approvedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    // 최근 30일 데이터로 스트릭 계산
    const since = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().slice(0, 10); })();
    const [weights, meals, exercises, sleeps, waters] = await Promise.all([
      db.listWeightsByUserRange(ctx.user.id, since, today),
      db.listMealsByUserRange(ctx.user.id, since, today),
      db.listExercisesByUserRange(ctx.user.id, since, today),
      db.listSleepsByUserRange(ctx.user.id, since, today),
      db.listWatersByUserRange(ctx.user.id, since, today),
    ]);
    const activeDates = new Set([
      ...weights.map(w => w.recordedDate),
      ...meals.map(m => m.recordedDate),
      ...exercises.map(e => e.recordedDate),
      ...sleeps.map(s => s.recordedDate),
      ...waters.map(w => w.recordedDate),
    ]);
    let streak = 0;
    const cur = new Date(today + "T00:00:00Z");
    while (true) {
      const d = cur.toISOString().slice(0, 10);
      if (!activeDates.has(d)) break;
      streak++;
      cur.setUTCDate(cur.getUTCDate() - 1);
    }
    return { streak, today };
  }),

  /** 주간 AI 요약: 지난 7일 인증 현황 기반 칭찬 or 개선 메시지 */
  weeklyNudge: approvedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    const since = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 6); return d.toISOString().slice(0, 10); })();
    const [weights, meals, exercises, sleeps, waters] = await Promise.all([
      db.listWeightsByUserRange(ctx.user.id, since, today),
      db.listMealsByUserRange(ctx.user.id, since, today),
      db.listExercisesByUserRange(ctx.user.id, since, today),
      db.listSleepsByUserRange(ctx.user.id, since, today),
      db.listWatersByUserRange(ctx.user.id, since, today),
    ]);
    const days = 7;
    const weightDays = new Set(weights.map(w => w.recordedDate)).size;
    const mealDays = new Set(meals.map(m => m.recordedDate)).size;
    const exerciseDays = new Set(exercises.map(e => e.recordedDate)).size;
    const sleepDays = new Set(sleeps.map(s => s.recordedDate)).size;
    const waterDays = new Set(waters.map(w => w.recordedDate)).size;
    const totalDaysActive = new Set([
      ...weights.map(w => w.recordedDate),
      ...meals.map(m => m.recordedDate),
      ...exercises.map(e => e.recordedDate),
    ]).size;

    // 메시지 결정 (규칙 기반, OpenAI 호출 없음)
    type Nudge = { type: "praise" | "improve"; text: string };
    const nudges: Nudge[] = [];

    if (totalDaysActive >= 6) nudges.push({ type: "praise", text: `이번 주 ${totalDaysActive}일 연속 활동 중이에요 🔥 이 페이스면 시즌 끝에 분명히 달라져 있을 거예요.` });
    else if (totalDaysActive >= 4) nudges.push({ type: "praise", text: `이번 주 ${totalDaysActive}일 기록했어요 👍 조금만 더 채우면 완벽한 한 주가 돼요.` });
    else nudges.push({ type: "improve", text: `이번 주 활동이 ${totalDaysActive}일이에요. 오늘 한 가지만 기록해도 흐름이 달라져요.` });

    if (mealDays < 3) nudges.push({ type: "improve", text: `이번 주 식단 기록이 ${mealDays}일뿐이에요. 먹은 것을 기록하는 것만으로도 식습관이 바뀌어요.` });
    if (waterDays < 3) nudges.push({ type: "improve", text: `이번 주 물 인증이 ${waterDays}일이에요. 하루 2L 목표를 기억해 주세요.` });
    if (exerciseDays >= 5) nudges.push({ type: "praise", text: `이번 주 운동을 ${exerciseDays}일이나 했어요 💪 근육이 고마워하고 있어요.` });
    if (weightDays >= 6) nudges.push({ type: "praise", text: `매일 체중을 기록하고 있어요. 데이터가 쌓일수록 변화가 선명해져요.` });

    // 가장 중요한 메시지 1개만 반환
    const praise = nudges.find(n => n.type === "praise");
    const improve = nudges.find(n => n.type === "improve");
    const result = totalDaysActive >= 5 ? (praise ?? improve) : (improve ?? praise);
    return {
      type: result?.type ?? "improve",
      text: result?.text ?? "오늘 첫 기록을 남겨보세요. 시작이 반이에요.",
      stats: { weightDays, mealDays, exerciseDays, sleepDays, waterDays, totalDaysActive, days },
    };
  }),

  /**
   * 실시간 감량 % 랭킹: 경쟁 동기부여는 유지하되, 결과 공식 공개는 종료 시점에 해주기 위해 랭크만
   * 숨기는 UI는 클라이언트에서 처리한다. 이 절차는 데이터의 일관성만 책임진다.
   */
  leaderboard: approvedProcedure.query(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const active = await db.ensureActiveSeasonAutoEnd(today);
    if (!active) return { season: null, entries: [] };
    const until = today < active.endDate ? today : active.endDate;
    const map = await computeLeaderboard(active.id, active.startDate, until);
    const userIds = Array.from(map.keys());
    const allUsers = await db.listAllUsers();
    const byId = new Map(allUsers.map(u => [u.id, u]));
    const entries = userIds
      .map(uid => {
        const e = map.get(uid)!;
        const u = byId.get(uid);
        return {
          userId: uid,
          name: u?.name ?? "멤버",
          avatarUrl: u?.avatarUrl ?? null,
          baselineWeightKg: e.baselineWeightKg,
          currentWeightKg: e.currentWeightKg,
          lossPercent: e.lossPercent,
          lossKg: e.lossKg,
        };
      })
      .sort((a, b) => b.lossPercent - a.lossPercent);
    return { season: active, entries };
  }),

  /**
   * 관리자 전용 — 진행 중 시즌의 인증 카운트 랭킹 (멤버에게는 공개되지 않음).
   * 1등 결정 기준: totalCount = weightCount + mealCount + exerciseCount + sleepCount.
   */
  adminLiveCounts: adminProcedure.query(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const active = await db.ensureActiveSeasonAutoEnd(today);
    if (!active) return { season: null, entries: [] };
    const until = today < active.endDate ? today : active.endDate;
    const allUsers = await db.listAllUsers();
    const approved = allUsers.filter(u => u.status === "approved");
    const entries = await Promise.all(approved.map(async (u) => {
      const c = await getMyCounts(active.id, u.id, active.startDate, until);
      return {
        userId: u.id,
        name: u.name ?? "멤버",
        avatarUrl: u.avatarUrl ?? null,
        weightCount: c.weight,
        mealCount: c.meal,
        exerciseCount: c.exercise,
        sleepCount: c.sleep,
        waterCount: c.water,
        totalCount: c.total,
      };
    }));
    entries.sort((a, b) => b.totalCount - a.totalCount);
    return { season: active, entries };
  }),

  /**
   * 아카이브 — 종료된 시즌 목록 (전체 공개).
   */
  archive: approvedProcedure.query(async () => {
    const all = await db.listSeasons();
    return all.filter(s => s.status === "ended").sort((a, b) => (b.seasonNumber ?? 0) - (a.seasonNumber ?? 0));
  }),

  /**
   * 아카이브 상세 — 종료된 시즌의 랭킹, 리포트, 1등을 포함해 반환.
   */
  archiveDetail: approvedProcedure
    .input(z.object({ seasonId: z.number() }))
    .query(async ({ input }) => {
      const all = await db.listSeasons();
      const season = all.find(s => s.id === input.seasonId);
      if (!season || season.status !== "ended") return { season: null, lossEntries: [], countEntries: [], reports: [], champion: null };

      const allUsers = await db.listAllUsers();
      const byId = new Map(allUsers.map(u => [u.id, u]));

      // 감량 % 랭킹
      const lossMap = await computeLeaderboard(season.id, season.startDate, season.endDate);
      const lossEntries = Array.from(lossMap.entries())
        .map(([uid, e]) => {
          const u = byId.get(uid);
          return {
            userId: uid,
            name: u?.name ?? "멤버",
            avatarUrl: u?.avatarUrl ?? null,
            baselineWeightKg: e.baselineWeightKg,
            currentWeightKg: e.currentWeightKg,
            lossPercent: e.lossPercent,
            lossKg: e.lossKg,
          };
        })
        .sort((a, b) => b.lossPercent - a.lossPercent);

      // 인증 카운트 랭킹 (→ 1등 결정 기준)
      const approved = allUsers.filter(u => u.status === "approved");
      const countEntries = await Promise.all(approved.map(async (u) => {
        const c = await getMyCounts(season.id, u.id, season.startDate, season.endDate);
        return {
          userId: u.id,
          name: u.name ?? "멤버",
          avatarUrl: u.avatarUrl ?? null,
          weightCount: c.weight,
          mealCount: c.meal,
          exerciseCount: c.exercise,
          sleepCount: c.sleep,
          waterCount: c.water,
          totalCount: c.total,
        };
      }));
      countEntries.sort((a, b) => b.totalCount - a.totalCount);
      const champion = countEntries.length > 0 && countEntries[0].totalCount > 0 ? countEntries[0] : null;

      // 리포트 (공개된 것과 소감 포함)
      try { await generateSeasonReports(season.id); } catch (e) { console.warn("[generateSeasonReports archiveDetail failed]", e); }
      const reports = (await db.listSeasonReports(season.id))
        .map(r => {
          const u = byId.get(r.userId);
          return {
            ...r,
            name: u?.name ?? "멤버",
            avatarUrl: u?.avatarUrl ?? null,
          };
        });

      return { season, lossEntries, countEntries, reports, champion };
    }),

  /**
   * 인증 카운트 Reveal — 시즌 마지막 날이거나 종료되었을 때만 공개.
   * 그 전에는 locked: true로 반환.
   */
  reveal: approvedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    const isAdmin = ctx.user.role === 'admin';
    let active = await db.getActiveSeason();
    let target = active;
    let revealable = false;
    if (active) {
      // 시즌이 종료되었는지 자동 판정
      if (active.endDate < today) {
        await db.endSeason(active.id);
        target = await db.getSeasonById(active.id);
        revealable = true;
        try { await generateSeasonReports(active.id); } catch (e) { console.warn("[generateSeasonReports auto-end failed]", e); }
      } else if (today === active.endDate) {
        revealable = true;
        // 마지막 날에는 최신 스냅샷을 미리 생성해 둔다 (이후 결과 리포트 조회는 추가 갱신됨)
        try { await generateSeasonReports(active.id); } catch (e) { console.warn("[generateSeasonReports last-day failed]", e); }
      }
    } else {
      // 가장 최근의 ended 시즌을 숨기지 않고 노출
      const list = await db.listSeasons();
      target = list.find(s => s.status === "ended") ?? list[0];
      revealable = !!target;
    }
    // 관리자는 시즌 종료 전에도 미리 볼 수 있어요
    if (isAdmin && target) revealable = true;
    if (!target) return { season: null, locked: false, entries: [] };
    if (!revealable) return { season: target, locked: true, entries: [] };
    const parts = await db.listParticipants(target.id);
    const allUsers = await db.listAllUsers();
    const byId = new Map(allUsers.map(u => [u.id, u]));
    const entries = await Promise.all(parts.map(async (p) => {
      const since = target!.startDate;
      const until = target!.endDate;
      const counts = await getMyCounts(target!.id, p.userId, since, until);
      const baseline = p.baselineWeightKg ? parseFloat(p.baselineWeightKg) : null;
      const latest = await db.getLatestWeightInRange(p.userId, since, until);
      const current = latest ? parseFloat(latest.weightKg) : null;
      const lossPct = baseline && current && baseline > 0 ? ((baseline - current) / baseline) * 100 : 0;
      return {
        userId: p.userId,
        name: byId.get(p.userId)?.name ?? "멤버",
        counts,
        baselineWeightKg: baseline,
        currentWeightKg: current,
        lossPercent: lossPct,
        lossKg: baseline && current ? +(baseline - current).toFixed(2) : null,
      };
    }));
    // 인증 총합 + 감량 % 기준 시상용 두 가지 랭킹
    const byTotal = [...entries].sort((a, b) => b.counts.total - a.counts.total);
    const byLoss = [...entries].sort((a, b) => b.lossPercent - a.lossPercent);
    // 이게돼 챔피언 (2026-11-20): 시즌 동안 행복 한 줄 일기를 가장 많이 쓴 사람
    let happyCounts: Array<{ userId: number; count: number }> = [];
    try { happyCounts = await db.happyNoteCountsByUser(target.startDate, target.endDate); } catch (e) { console.warn("[reveal] happy counts failed", e); }
    const byHappy = happyCounts
      .filter(h => entries.some(e => e.userId === h.userId))
      .map(h => ({ userId: h.userId, name: byId.get(h.userId)?.name ?? "멤버", count: h.count }));
    return { season: target, locked: false, entries, byTotal, byLoss, byHappy };
  }),

  /* ============== Season photos (Before / Progress / After) ============== */

  myPhotos: approvedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    const active = await db.ensureActiveSeasonAutoEnd(today);
    const target = active ?? (await db.listSeasons()).find(s => s.status === "ended");
    if (!target) return { season: null, photos: [], required: { beforeFront: false, beforeSide: false, afterFront: false, afterSide: false } };
    const photos = await db.listSeasonPhotos(target.id, ctx.user.id);
    const has = (slot: "before" | "after", angle: "front" | "side") =>
      photos.some(p => p.slot === slot && p.angle === angle);
    return {
      season: target,
      photos: photos.map(p => ({
        id: p.id,
        dayNumber: p.dayNumber,
        slot: p.slot,
        angle: p.angle,
        photoUrl: p.photoUrl,
        createdAt: p.createdAt,
      })),
      required: {
        beforeFront: has("before", "front"),
        beforeSide: has("before", "side"),
        afterFront: has("after", "front"),
        afterSide: has("after", "side"),
      },
    };
  }),

  uploadPhoto: approvedProcedure
    .input(z.object({
      slot: z.enum(["before", "progress", "after"]),
      angle: z.enum(["front", "side"]),
      photoBase64: z.string().min(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const today = new Date().toISOString().slice(0, 10);
      const active = await db.ensureActiveSeasonAutoEnd(today);
      if (!active) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "진행 중인 시즌이 없어요." });
      }
      const day = dayNumber(active.startDate, active.endDate, today);
      if (!day) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "오늘은 시즌 기간이 아니에요." });
      }
      // before는 Day 1에만, after는 마지막 날(Day 13 = totalDays)에만 허용한다.
      const total = totalDays(active.startDate, active.endDate);
      if (input.slot === "before" && day !== 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "BEFORE 사진은 챌린지 1일차에만 올릴 수 있어요." });
      }
      if (input.slot === "after" && day !== total) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `AFTER 사진은 마지막 날(${total}일차)에만 올릴 수 있어요.` });
      }
      const matches = input.photoBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!matches) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "이미지 데이터 형식이 올바르지 않아요." });
      }
      const mime = matches[1];
      const ext = mime.split("/")[1].replace("+xml", "");
      const buf = Buffer.from(matches[2], "base64");
      const key = `season-photos/${active.id}/${ctx.user.id}/${input.slot}-${input.angle}-${Date.now()}.${ext}`;
      const { key: storedKey, url } = await storagePut(key, buf, mime);
      // ensure participant exists
      await db.getOrCreateParticipant(active.id, ctx.user.id);
      await db.upsertSeasonPhoto({
        seasonId: active.id,
        userId: ctx.user.id,
        dayNumber: day,
        slot: input.slot,
        angle: input.angle,
        photoKey: storedKey,
        photoUrl: url,
      });
      return { ok: true, photoUrl: url };
    }),

  deletePhoto: approvedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteSeasonPhoto(input.id, ctx.user.id);
      return { ok: true };
    }),

  /* ============== Season report (final) ============== */

  myReport: approvedProcedure.query(async ({ ctx }) => {
    // Pick season: ended one preferred, else current if today is the last day.
    const today = new Date().toISOString().slice(0, 10);
    const isAdmin = ctx.user.role === 'admin';
    let target = (await db.listSeasons()).find(s => s.status === "ended");
    if (!target) {
      const active = await db.getActiveSeason();
      if (active && today === active.endDate) target = active;
    }
    if (!target) {
      const active = await db.getActiveSeason();
      if (active) {
        // 관리자는 시즌 종료 전에도 미리 볼 수 있어요
        if (isAdmin) {
          target = active;
        } else {
          const day = dayNumber(active.startDate, active.endDate, today);
          const total = totalDays(active.startDate, active.endDate);
          return { locked: true, season: active, dayNumber: day, totalDays: total, report: null, photos: [] };
        }
      }
      if (!target) {
        return { locked: true, season: null, dayNumber: null, totalDays: 0, report: null, photos: [] };
      }
    }
    // Generate / refresh report on read.
    const counts = await getMyCounts(target.id, ctx.user.id, target.startDate, target.endDate);
    const part = await db.getParticipant(target.id, ctx.user.id);
    const baseline = part?.baselineWeightKg ? parseFloat(part.baselineWeightKg) : null;
    const latest = await db.getLatestWeightInRange(ctx.user.id, target.startDate, target.endDate);
    const finalWeight = latest ? parseFloat(latest.weightKg) : null;
    const lossPct = baseline && finalWeight && baseline > 0 ? ((baseline - finalWeight) / baseline) * 100 : 0;
    const total = totalDays(target.startDate, target.endDate);
    const finalSm = latest?.skeletalMuscleKg ? parseFloat(latest.skeletalMuscleKg) : null;
    const finalBf = latest?.bodyFatPercent ? parseFloat(latest.bodyFatPercent) : null;
    const completed = counts.weight >= total && counts.meal >= total && counts.exercise >= total;
    const score = counts.total + (completed ? 13 : 0);
    const photos = await db.listSeasonPhotos(target.id, ctx.user.id);
    // Persist a snapshot so reflection can be saved separately.
    const existing = await db.getSeasonReport(target.id, ctx.user.id);
    await db.upsertSeasonReport({
      seasonId: target.id,
      userId: ctx.user.id,
      baselineWeightKg: baseline?.toFixed(2),
      finalWeightKg: finalWeight?.toFixed(2),
      lossPercent: lossPct.toFixed(3),
      finalSkeletalMuscleKg: finalSm?.toFixed(2),
      finalBodyFatPercent: finalBf?.toFixed(2),
      weightCount: counts.weight,
      mealCount: counts.meal,
      exerciseCount: counts.exercise,
      totalCount: counts.total,
      participationScore: score,
      completed,
      reflection: existing?.reflection ?? null,
      isPublic: existing?.isPublic ?? true,
    });
    const report = await db.getSeasonReport(target.id, ctx.user.id);
    return {
      locked: false,
      season: target,
      dayNumber: dayNumber(target.startDate, target.endDate, today),
      totalDays: total,
      report,
      photos: photos.map(p => ({ id: p.id, dayNumber: p.dayNumber, slot: p.slot, angle: p.angle, photoUrl: p.photoUrl })),
    };
  }),

  saveReflection: approvedProcedure
    .input(z.object({
      seasonId: z.number(),
      reflection: z.string().max(2000),
      isPublic: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateSeasonReportReflection(input.seasonId, ctx.user.id, input.reflection, input.isPublic);
      return { ok: true };
    }),

  /** 허리 둘레 기록 조회 */
  myWaist: approvedProcedure
    .input(z.object({ seasonId: z.number() }))
    .query(async ({ ctx, input }) => {
      const row = await db.getWaistRecord(input.seasonId, ctx.user.id);
      if (!row) return null;
      return {
        beforeCm: row.beforeCm !== null && row.beforeCm !== undefined ? Number(row.beforeCm) : null,
        afterCm: row.afterCm !== null && row.afterCm !== undefined ? Number(row.afterCm) : null,
        updatedAt: row.updatedAt,
      };
    }),

  /** 허리 둘레 기록 저장 */
  saveWaist: approvedProcedure
    .input(z.object({
      seasonId: z.number(),
      beforeCm: z.number().min(40).max(200).nullable().optional(),
      afterCm: z.number().min(40).max(200).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.saveWaistRecord(
        input.seasonId,
        ctx.user.id,
        input.beforeCm ?? null,
        input.afterCm ?? null,
      );
      return { ok: true };
    }),

  publicReports: approvedProcedure.query(async () => {
    // Pick the most recent ended season; if none, pick active season on its last day; else null.
    const today = new Date().toISOString().slice(0, 10);
    const list = await db.listSeasons();
    let target = list.find(s => s.status === "ended");
    if (!target) {
      const active = list.find(s => s.status === "active");
      if (active && today >= active.endDate) target = active;
    }
    if (!target) return { season: null, locked: true, entries: [] };
    // 모든 참가자 리포트를 최신화 (아직 /season-report를 열지 않은 멤버 포함).
    try { await generateSeasonReports(target.id); } catch (e) { console.warn("[generateSeasonReports publicReports failed]", e); }
    const reports = await db.listSeasonReports(target.id);
    const allUsers = await db.listAllUsers();
    const byId = new Map(allUsers.map(u => [u.id, u]));
    const entries = reports
      .filter(r => r.isPublic)
      .map(r => {
        const u = byId.get(r.userId);
        return {
          userId: r.userId,
          name: u?.name ?? "멤버",
          baselineWeightKg: r.baselineWeightKg ? parseFloat(r.baselineWeightKg) : null,
          finalWeightKg: r.finalWeightKg ? parseFloat(r.finalWeightKg) : null,
          lossPercent: r.lossPercent ? parseFloat(r.lossPercent) : 0,
          weightCount: r.weightCount,
          mealCount: r.mealCount,
          exerciseCount: r.exerciseCount,
          sleepCount: (r as { sleepCount?: number }).sleepCount ?? 0,
          waterCount: (r as { waterCount?: number }).waterCount ?? 0,
          totalCount: r.totalCount,
          completed: r.completed,
          reflection: r.reflection,
        };
      })
      .sort((a, b) => b.lossPercent - a.lossPercent);
    return { season: target, locked: false, entries };
  }),
});

/* ----------------- Sleeps ----------------- */
const sleepHourSchema = z.number().int().min(0).max(23);
const sleepMinuteSchema = z.number().int().min(0).max(59).refine((v) => v % 10 === 0, {
  message: "분은 10분 단위로만 선택할 수 있습니다",
});

const sleepRouter = router({
  /** 특정 날짜(기상일)의 수면 기록. 기본값: 오늘. */
  byDate: approvedProcedure
    .input(z.object({ date: dateString }).optional())
    .query(async ({ ctx, input }) => {
      const date = input?.date ?? new Date().toISOString().slice(0, 10);
      const row = await db.getSleepByDate(ctx.user.id, date);
      return row ?? null;
    }),

  /** 내 수면 추이. since부터 오늘까지. */
  list: approvedProcedure
    .input(z.object({ since: dateString.optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.listSleepsByUser(ctx.user.id, input?.since);
    }),

  /**
   * 수면 업서트 — 기상일(recordedDate)과 취침/기상 시각(시/분)을 받아
   * 손쉽게 계산해 저장하고 평가 메시지를 함께 리턴한다.
   * bedAt/wakeAt 는 클라이언트의 로컬 시간을 그대로 저장하기 위해
   * 서버에서 YYYY-MM-DD HH:mm:ss 형식으로 재구성한다.
   */
  upsert: approvedProcedure
    .input(z.object({
      recordedDate: dateString,
      bedHour: sleepHourSchema,
      bedMinute: sleepMinuteSchema,
      wakeHour: sleepHourSchema,
      wakeMinute: sleepMinuteSchema,
      /** 기상 인증: 아침 따뜻한 물 한 잔 사진 (2026-11-20) */
      photoBase64: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const evalResult = evaluateSleep(input.bedHour, input.bedMinute, input.wakeHour, input.wakeMinute);
      let morningPhotoUrl: string | null = null;
      const pm = input.photoBase64?.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (pm) {
        try {
          const { url } = await storagePut(`wake/${ctx.user.id}/${input.recordedDate}_${Date.now()}.${pm[1].split("/")[1].replace("+xml", "")}`, Buffer.from(pm[2], "base64"), pm[1]);
          morningPhotoUrl = url;
        } catch (e) { console.warn("[wake photo upload failed]", e); }
      }
      // bedAt: 기상일 기준, 자정 이후 취침이면 기상일 당일, 그렇지 않으면 전일 저녁으로 저장.
      const wakeDate = new Date(input.recordedDate + "T00:00:00Z");
      const bedIsAm = input.bedHour < 12; // 0–11시면 자정 이후 취침
      const bedDate = new Date(wakeDate);
      if (!bedIsAm) bedDate.setUTCDate(bedDate.getUTCDate() - 1);
      bedDate.setUTCHours(input.bedHour, input.bedMinute, 0, 0);
      const wakeAt = new Date(wakeDate);
      wakeAt.setUTCHours(input.wakeHour, input.wakeMinute, 0, 0);
      const id = await db.upsertSleep({
        userId: ctx.user.id,
        recordedDate: input.recordedDate,
        bedAt: bedDate,
        wakeAt: wakeAt,
        durationMinutes: evalResult.durationMinutes,
        bedHour: input.bedHour,
        bedMinute: input.bedMinute,
        wakeHour: input.wakeHour,
        wakeMinute: input.wakeMinute,
      });
      if (morningPhotoUrl) await db.setSleepMorningPhoto(ctx.user.id, input.recordedDate, morningPhotoUrl).catch(e => console.warn("[wake photo save]", e));
      return {
        morningPhotoUrl,
        id,
        durationMinutes: evalResult.durationMinutes,
        status: evalResult.status,
        message: evalResult.message,
        pastMidnight: evalResult.pastMidnight,
      };
    }),

  /** 클라이언트 입력에 대한 수면시간/상태/메시지 추정 (저장 안함) */
  preview: approvedProcedure
    .input(z.object({
      bedHour: sleepHourSchema,
      bedMinute: sleepMinuteSchema,
      wakeHour: sleepHourSchema,
      wakeMinute: sleepMinuteSchema,
    }))
    .query(({ input }) => {
      const r = evaluateSleep(input.bedHour, input.bedMinute, input.wakeHour, input.wakeMinute);
      return r;
    }),
});

/* ----------------- Waters ----------------- */
const WATER_VOLUMES = [300, 400, 500, 600, 700, 800, 900, 1000] as const;
const waterVolumeSchema = z.number().int().refine(
  (v) => v >= 300 && v <= 1000 && v % 100 === 0,
  { message: "물 용량은 300~1000ml 범위의 100ml 단위로만 선택할 수 있습니다" }
);

/** 행복 한 줄 일기 — 어제 기분 / 나를 위해 한 좋은 일 / 오늘 나에게 하는 약속 */
const happyRouter = router({
  byDate: approvedProcedure
    .input(z.object({ date: dateString }))
    .query(async ({ ctx, input }) => db.getHappyNote(ctx.user.id, input.date)),
  recent: approvedProcedure
    .input(z.object({ since: dateString, until: dateString }))
    .query(async ({ ctx, input }) => db.listHappyNotes(ctx.user.id, input.since, input.until)),
  /** 따·잠·마·음·운 체크 저장 */
  saveChecks: approvedProcedure
    .input(z.object({
      date: dateString,
      mood: z.number().int().min(0).max(4),
      warm: z.boolean(), slept: z.boolean(), cleanEat: z.boolean(), exercised: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertHappyChecks(ctx.user.id, input.date, input);
      return { ok: true };
    }),
  /** 날짜 아래 한 줄: 오늘의 운세(재미용)·어제 돌아보기 한마디 */
  dailyLines: approvedProcedure
    .input(z.object({ date: dateString, birthDate: dateString.optional(), fortune: z.boolean(), coach: z.boolean() }))
    .query(async ({ ctx, input }) => getDailyLines(ctx.user.id, input.date, input)),
  /** 1년 진행 막대: 올해 기록한 날 수 */
  yearProgress: protectedProcedure.query(async ({ ctx }) => {
    const year = new Date(Date.now() + 9 * 3600 * 1000).getUTCFullYear();
    const days = await db.countRecordDaysInYear(ctx.user.id, year);
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return { year, days, total: isLeap ? 366 : 365 };
  }),
  upsert: approvedProcedure
    .input(z.object({
      date: dateString,
      mood: z.number().int().min(1).max(4),
      goodThing: z.string().max(300),
      promise: z.string().max(300),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.goodThing.trim() && !input.promise.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "한 줄만이라도 적어 주세요." });
      }
      await db.upsertHappyNote(ctx.user.id, input.date, input.mood, input.goodThing.trim(), input.promise.trim());
      return { ok: true };
    }),
});

/** 회차·시상·이게돼·1년 (2026-11-20) */
const roundsRouter = router({
  /** 지금 회차 기준 항목별 내 인증 번호 */
  myCounts: approvedProcedure.query(async ({ ctx }) => {
    const r = await rounds.countRange();
    return { ...r, counts: await rounds.itemCounts(ctx.user.id, r.since, r.until) };
  }),
  current: approvedProcedure.query(async () => {
    const s = await rounds.activeRound();
    return s ? { id: s.id, name: s.name, startDate: String(s.startDate).slice(0, 10) } : null;
  }),
  start: adminProcedure
    .input(z.object({ type: z.enum(["detox", "mini"]) }))
    .mutation(async ({ ctx, input }) => rounds.startRound(ctx.user.id, input.type)),
  end: adminProcedure.mutation(async () => rounds.endRound()),
  ceremony: approvedProcedure.query(async () => rounds.ceremony()),
  history: approvedProcedure.query(async () => rounds.history()),
  updateAward: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().max(128).optional(), count: z.number().int().min(0).optional() }))
    .mutation(async ({ input }) => { await rounds.updateAward(input.id, input); return { ok: true }; }),
  rename: adminProcedure
    .input(z.object({ seasonId: z.number(), name: z.string().min(1).max(128) }))
    .mutation(async ({ input }) => { await rounds.renameRound(input.seasonId, input.name); return { ok: true }; }),
  /** 시즌 (2026-11-22) */
  startSeason: adminProcedure
    .input(z.object({ name: z.string().min(1).max(128), shortName: z.string().max(32), planEnd: dateString, detoxStart: dateString.optional().nullable(), detoxEnd: dateString.optional().nullable() }))
    .mutation(async ({ ctx, input }) => sp.startSeason(ctx.user.id, input, () => rounds.endRound())),
  seasonInfo: approvedProcedure.query(async () => sp.activeSeasonInfo()),
  allSeasons: approvedProcedure.query(async () => sp.allSeasonInfos()),
  myEntry: approvedProcedure.query(async ({ ctx }) => sp.myEntry(ctx.user.id)),
  join: approvedProcedure.input(z.object({ track: z.enum(["detox", "routine"]) })).mutation(async ({ ctx, input }) => sp.join(ctx.user.id, input.track)),
  entryCounts: adminProcedure.input(z.object({ seasonId: z.number() })).query(async ({ input }) => sp.entryCounts(input.seasonId)),
  weighStatus: approvedProcedure.query(async ({ ctx }) => sp.weighStatus(ctx.user.id)),
  setMvp: adminProcedure.input(z.object({ seasonId: z.number(), userId: z.number(), name: z.string().min(1).max(128) }))
    .mutation(async ({ input }) => { await sp.setMvp(input.seasonId, input.userId, input.name); return { ok: true }; }),
  /** 내 시즌별 결과 (나의 1년) */
  mySeasonSummary: approvedProcedure.input(z.object({ seasonId: z.number() })).query(async ({ ctx, input }) => {
    const all = await sp.allSeasonInfos();
    const s = all.find(x => x.id === input.seasonId); if (!s) return null;
    const until = s.status === "active" ? rounds.kstToday() : (s.planEnd ?? rounds.kstToday());
    const counts = await rounds.itemCounts(ctx.user.id, s.startDate, until);
    const w = await db.getDb().then(c => c ? c.execute(sqlTag`SELECT kg, DATE_FORMAT(recordedDate,'%Y-%m-%d') d FROM weights WHERE userId=${ctx.user.id} AND recordedDate BETWEEN ${s.startDate} AND ${until} ORDER BY recordedDate`) : null).catch(() => null);
    const ws = Array.isArray(w) && Array.isArray((w as any)[0]) ? (w as any)[0] : [];
    return { season: s, counts, weightStart: ws[0] ? Number(ws[0].kg) : null, weightEnd: ws.length > 1 ? Number(ws[ws.length - 1].kg) : null };
  }),
  /** 1년 달력: 날짜별 기상·식단 여부 */
  dayFlags: approvedProcedure
    .input(z.object({ since: dateString, until: dateString }))
    .query(async ({ ctx, input }) => rounds.dayFlags(ctx.user.id, input.since, input.until)),
});

/* 의견 보내기 · 선물/이벤트 신청 (2026-11-22) */
const crewRouter = router({
  sendFeedback: approvedProcedure
    .input(z.object({ kind: z.enum(["bug", "idea"]), text: z.string().min(2).max(3000), imageDataUrl: z.string().max(8_000_000).optional() }))
    .mutation(async ({ ctx, input }) => {
      let url: string | null = null;
      if (input.imageDataUrl) url = (await uploadDataUrl(input.imageDataUrl, `feedback/${ctx.user.id}-${Date.now()}`)).url;
      await sp.addFeedback(ctx.user.id, input.kind, input.text.trim(), url);
      return { ok: true };
    }),
  awardOptions: approvedProcedure.query(async ({ ctx }) => ({ ...(await sp.awardOptions(ctx.user.id)), contact: await roster.getMyContact(ctx.user.id) })),
  eventBoard: approvedProcedure.query(async ({ ctx }) => sp.eventBoard(ctx.user.id)),
  eventApplicants: approvedProcedure.input(z.object({ eventId: z.number() })).query(async ({ input }) => sp.eventApplicants(input.eventId)),
  joinEvent: approvedProcedure.input(z.object({ eventId: z.number() })).mutation(async ({ ctx, input }) => sp.joinEvent(ctx.user.id, input.eventId)),
  feedbacks: adminProcedure.query(async () => sp.listFeedbacks()),
  feedbackDone: adminProcedure.input(z.object({ id: z.number(), done: z.boolean() })).mutation(async ({ input }) => { await sp.setFeedbackDone(input.id, input.done); return { ok: true }; }),
  myOptions: approvedProcedure.query(async ({ ctx }) => ({
    gifts: await sp.myGifts(ctx.user.id),
    events: await sp.listOpenEvents(true),
    myEventIds: await sp.myEventIds(ctx.user.id),
    contact: await roster.getMyContact(ctx.user.id),
  })),
  request: approvedProcedure
    .input(z.object({ kind: z.enum(["gift", "event"]), refId: z.number(), label: z.string().min(1).max(200), realName: z.string().min(1).max(64), phone: z.string().min(9).max(32), address: z.string().min(5).max(300), saveAsDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      await sp.addRequest(ctx.user.id, input);
      if (input.saveAsDefault) await roster.updateMyContact(ctx.user.id, { phone: input.phone, address: input.address });
      return { ok: true };
    }),
  requests: adminProcedure.query(async () => sp.listRequests()),
  requestSent: adminProcedure.input(z.object({ id: z.number(), sent: z.boolean() })).mutation(async ({ input }) => { await sp.setRequestSent(input.id, input.sent); return { ok: true }; }),
  events: adminProcedure.query(async () => sp.listOpenEvents(false)),
  addEvent: adminProcedure.input(z.object({ title: z.string().min(1).max(200) })).mutation(async ({ input }) => { await sp.addEvent(input.title.trim()); return { ok: true }; }),
  setEventOpen: adminProcedure.input(z.object({ id: z.number(), open: z.boolean() })).mutation(async ({ input }) => { await sp.setEventOpen(input.id, input.open); return { ok: true }; }),
});

const itgeRouter = router({
  create: approvedProcedure
    .input(z.object({ date: dateString, content: z.string().min(2).max(3000) }))
    .mutation(async ({ ctx, input }) => rounds.createItge(ctx.user.id, input.date, input.content.trim())),
  mine: approvedProcedure.query(async ({ ctx }) => rounds.listItge(ctx.user.id)),
  byUser: approvedProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => rounds.listItge(input.userId)),
  crew: approvedProcedure.query(async () => rounds.itgeCrew()),
});

/* ----------------- 몸 정보·컨디션·운동 상세·권장량·방장 상세 (2026-11-21) ----------------- */
async function uploadDataUrl(dataUrl: string, keyBase: string) {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) throw new TRPCError({ code: "BAD_REQUEST", message: "사진 형식이 올바르지 않아요." });
  const ext = m[1].split("/")[1].replace("+xml", "");
  return storagePut(`${keyBase}.${ext}`, Buffer.from(m[2], "base64"), m[1]);
}
const lockGuard = (user: { role: string }, date: string) => {
  try { wellness.assertEditable(user, date); }
  catch { throw new TRPCError({ code: "FORBIDDEN", message: "밤 12시가 지난 날짜는 기록·수정할 수 없어요." }); }
};
const profileInput = z.object({
  avatarBase64: z.string().optional(),
  sex: z.enum(["female", "male"]),
  birthYear: z.number().int().min(1930).max(2015),
  heightCm: z.number().min(120).max(220),
  weightKg: z.number().min(30).max(250).optional(),
  activity: z.enum(["low", "mid", "high"]),
  pregnant: z.boolean(),
  lactating: z.boolean(),
  flags: z.array(z.enum(wellness.FLAG_KEYS)).max(10),
  healthNote: z.string().max(1000).nullable().optional(),
  healthConsent: z.boolean(),
});
const wellnessRouter = router({
  /** 내 몸 정보 (본인) — 프로필 사진·몸 정보가 없으면 입력 화면을 띄운다 */
  myProfile: protectedProcedure.query(async ({ ctx }) => {
    const p = await wellness.getProfile(ctx.user.id);
    const w = await wellness.latestWeight(ctx.user.id);
    const u = await db.getUserById(ctx.user.id);
    return { profile: p, weightKg: w, avatarUrl: u?.avatarUrl ?? null, needsSetup: !p || !w || !u?.avatarUrl };
  }),
  saveProfile: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
    if (input.avatarBase64) {
      const { url } = await uploadDataUrl(input.avatarBase64, `avatars/${ctx.user.id}/${Date.now()}`);
      await db.updateUserProfile(ctx.user.id, { avatarUrl: url });
    } else {
      const u = await db.getUserById(ctx.user.id);
      if (!u?.avatarUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "프로필 사진을 꼭 올려 주세요." });
    }
    // 2026-11-21: 처음 입력 때는 기존 기록이 있어도 몸무게를 직접 넣는다 → 넣은 값으로 오늘 몸무게 저장
    const prof = await wellness.getProfile(ctx.user.id);
    if (!prof && !input.weightKg) throw new TRPCError({ code: "BAD_REQUEST", message: "몸무게를 입력해 주세요." });
    await wellness.saveProfile(ctx.user.id, {
      sex: input.sex, birthYear: input.birthYear, heightCm: input.heightCm, activity: input.activity,
      pregnant: input.pregnant, lactating: input.lactating, flags: input.flags,
      healthNote: input.healthNote ?? null, healthConsent: input.healthConsent,
    }, !prof ? input.weightKg : undefined);
    return { ok: true };
  }),
  condition: approvedProcedure.input(z.object({ date: dateString })).query(async ({ ctx, input }) => wellness.getCondition(ctx.user.id, input.date)),
  setCondition: approvedProcedure.input(z.object({ date: dateString, level: z.enum(wellness.CONDITIONS) })).mutation(async ({ ctx, input }) => {
    lockGuard(ctx.user, input.date);
    await wellness.setCondition(ctx.user.id, input.date, input.level);
    return { ok: true };
  }),
  /** 오늘 권장량 + 부족/넘침 한 줄 */
  intake: approvedProcedure.input(z.object({ date: dateString })).query(async ({ ctx, input }) => wellness.intakeLine(ctx.user.id, input.date)),
  sports: publicProcedure.query(() => wellness.SPORTS.map(s => ({ id: s.id, name: s.name, kind: s.kind }))),
  analyzeWorkout: approvedProcedure.input(z.object({ photoBase64: z.string().min(20) })).mutation(async ({ ctx, input }) => {
    const { url } = await uploadDataUrl(input.photoBase64, `workout-ai-tmp/${ctx.user.id}/${Date.now()}`);
    const r = await wellness.analyzeWorkoutImage(url);
    if (!r) throw new TRPCError({ code: "BAD_REQUEST", message: "캡처를 읽지 못했어요. 직접 입력해 주세요." });
    return r;
  }),
  /** 새 운동 기록 (상세 칸 + 느낌 + 땀 + 코멘트) */
  createExercise: approvedProcedure.input(z.object({
    recordedDate: dateString,
    sport: z.string().max(32),
    minutes: z.number().int().min(1).max(1440),
    feel: z.enum(wellness.FEELS),
    sweat: z.boolean(),
    distanceKm: z.number().min(0).max(500).nullable().optional(),
    paceSec: z.number().int().min(0).max(3600).nullable().optional(),
    speedKmh: z.number().min(0).max(100).nullable().optional(),
    steps: z.number().int().min(0).max(200000).nullable().optional(),
    avgHr: z.number().int().min(0).max(250).nullable().optional(),
    laps: z.number().int().min(0).max(1000).nullable().optional(),
    kcalWatch: z.number().int().min(0).max(10000).nullable().optional(),
    note: z.string().max(500).optional(),
    photoBase64: z.string(),
  })).mutation(async ({ ctx, input }) => {
    lockGuard(ctx.user, input.recordedDate);
    const stored = await uploadDataUrl(input.photoBase64, `exercise/${ctx.user.id}/${input.recordedDate}_${Date.now()}`);
    const sportName = wellness.SPORTS.find(s => s.id === input.sport)?.name ?? "기타";
    const id = await db.createExercise({
      userId: ctx.user.id, recordedDate: input.recordedDate, kind: sportName, durationMin: input.minutes,
      intensity: input.feel === "easy" ? "low" : input.feel === "max" ? "high" : "medium",
      note: input.note ?? null, photoKey: stored.key, photoUrl: stored.url,
    });
    const c = await wellness.exerciseComment(ctx.user.id, input.recordedDate, {
      sport: input.sport, minutes: input.minutes, feel: input.feel, sweat: input.sweat,
      distanceKm: input.distanceKm ?? null, paceSec: input.paceSec ?? null, speedKmh: input.speedKmh ?? null,
    });
    await wellness.saveExerciseDetail(id, ctx.user.id, {
      sport: input.sport, distanceKm: input.distanceKm ?? null, paceSec: input.paceSec ?? null, speedKmh: input.speedKmh ?? null,
      steps: input.steps ?? null, avgHr: input.avgHr ?? null, laps: input.laps ?? null, kcalWatch: input.kcalWatch ?? null,
      feel: input.feel, sweat: input.sweat, comment: c.text,
    });
    return { id, comment: c.text, what: c.what, warn: c.warn, photoUrl: stored.url };
  }),
  exerciseDetails: approvedProcedure.input(z.object({ ids: z.array(z.number()).max(100) })).query(async ({ ctx, input }) => {
    const rows = await wellness.exerciseDetailsFor(input.ids);
    return rows.filter((r: any) => Number(r.userId) === ctx.user.id || ctx.user.role === "admin");
  }),
  /** 방장·본인만: 멤버 상세 */
  memberDetail: approvedProcedure.input(z.object({ userId: z.number() })).query(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "방장과 본인만 볼 수 있어요." });
    return wellness.memberDetail(input.userId);
  }),
  careList: adminProcedure.query(async () => wellness.careList()),
  entryCode: adminProcedure.query(async () => entryCode.currentEntryCode()),
  rotateEntryCode: adminProcedure.input(z.object({ days: z.number().int().min(3).max(90).optional() })).mutation(async ({ input }) => entryCode.rotateEntryCode(input.days)),
  analyzeScale: approvedProcedure.input(z.object({ photoBase64: z.string().min(20) })).mutation(async ({ ctx, input }) => {
    const { url } = await uploadDataUrl(input.photoBase64, `scale-ai-tmp/${ctx.user.id}/${Date.now()}`);
    const r = await wellness.analyzeScaleImage(url);
    if (!r) throw new TRPCError({ code: "BAD_REQUEST", message: "사진을 읽지 못했어요. 직접 입력해 주세요." });
    return r;
  }),
  weighIn: approvedProcedure.query(async ({ ctx }) => wellness.weighInStatus(ctx.user.id)),
});

const watersRouter = router({
  byDate: approvedProcedure
    .input(z.object({ date: dateString }))
    .query(async ({ ctx, input }) => {
      const rows = await db.listWatersByDate(ctx.user.id, input.date);
      const totalMl = rows.reduce((acc, r) => acc + (r.volumeMl || 0), 0);
      return { items: rows, totalMl };
    }),

  /** 사진 여러 장(N장) + 장당 용량(이미 동일 세트로 선택됨) → N건 인증을 의미한다. */
  multiCreate: approvedProcedure
    .input(z.object({
      recordedDate: dateString,
      volumeMl: waterVolumeSchema,
      photoBase64: z.array(z.string().min(8)).min(1).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      lockGuard(ctx.user, input.recordedDate);
      const ids: number[] = [];
      for (let i = 0; i < input.photoBase64.length; i++) {
        const base64 = input.photoBase64[i];
        const matches = base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!matches) continue;
        const mime = matches[1];
        const ext = mime.split("/")[1].replace("+xml", "");
        const buf = Buffer.from(matches[2], "base64");
        const ts = Date.now();
        const key = `waters/${ctx.user.id}/${ts}_${i}.${ext}`;
        try {
          const { key: storedKey, url } = await storagePut(key, buf, mime);
          const id = await db.createWater({
            userId: ctx.user.id,
            recordedDate: input.recordedDate,
            volumeMl: input.volumeMl,
            photoKey: storedKey,
            photoUrl: url,
          });
          ids.push(id);
        } catch (e) {
          console.warn("[Water photo upload failed]", e);
        }
      }
      return { ids, count: ids.length };
    }),

  delete: approvedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const row = await db.getWaterById(input.id);
      if (!row) return { ok: false };
      if (row.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다." });
      }
      lockGuard(ctx.user, String(row.recordedDate).slice(0, 10));
      await db.deleteWater(input.id);
      return { ok: true };
    }),

  /** 대시보드용 추이. since~until 일별 누적 ml 시리즈. */
  myRange: approvedProcedure
    .input(z.object({ since: dateString, until: dateString }))
    .query(async ({ ctx, input }) => {
      const rows = await db.listWatersByUserRange(ctx.user.id, input.since, input.until);
      // group by recordedDate
      const map = new Map<string, number>();
      for (const r of rows) {
        map.set(r.recordedDate, (map.get(r.recordedDate) ?? 0) + (r.volumeMl || 0));
      }
      return Array.from(map.entries())
        .map(([date, totalMl]) => ({ date, totalMl }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }),
});

/* ----------------- Root ----------------- */
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    /** 명단 확인 (2026-11-22): 이름+전화번호가 명단에 있으면 닉네임을 알려 준다 */
    rosterCheck: protectedProcedure
      .input(z.object({ realName: z.string().min(1).max(64), phone: z.string().min(9).max(32) }))
      .mutation(async ({ ctx, input }) => {
        const r = await roster.findRosterMatch(input.realName, input.phone, ctx.user.id);
        return r ? { matched: true as const, nickname: String(r.nickname), address: (r.address as string | null) ?? null } : { matched: false as const, nickname: null, address: null };
      }),

    /** 가입 신청 (2026-11-22): 명단에 있으면 바로 입장, 없으면 승인 대기. 입장코드는 더 이상 받지 않는다 */
    submitOnboarding: protectedProcedure
      .input(z.object({
        seasonCode: z.string().optional(),
        realName: z.string().min(1).max(64),
        phone: z.string().min(9).max(32),
        nickname: z.string().max(20).optional(),
        email: z.string().max(320).optional(),
        address: z.string().max(300).optional(),
        joinPurpose: z.string().max(500).optional(),
        agreed1: z.boolean(),
        agreed2: z.boolean(),
        privacy: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!input.agreed1 || !input.agreed2 || !input.privacy) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "동의 항목을 모두 확인해 주세요." });
        }
        const match = await roster.findRosterMatch(input.realName, input.phone, ctx.user.id);
        if (!match) {
          if (!input.nickname?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "닉네임을 적어 주세요." });
          if (!input.address?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "주소를 적어 주세요." });
        }
        await db.completeOnboarding(ctx.user.id, {
          realName: input.realName.trim(),
          phone: input.phone.trim(),
          joinPurpose: input.joinPurpose,
          agreedToTerms: true,
        });
        await roster.saveSignupExtras(ctx.user.id, {
          address: (input.address?.trim() || match?.address || null) as any,
          contactEmail: input.email?.trim() || null,
          privacyAgreed: true,
        });
        if (match) {
          await db.updateUserProfile(ctx.user.id, { name: String(match.nickname) });
          await db.updateUserStatus(ctx.user.id, "approved");
          await roster.markRosterUsed(Number(match.id), ctx.user.id);
          const season = await db.getActiveSeason();
          if (season) await db.grantSeasonToken(ctx.user.id, season.id);
          return { ok: true, matched: true, nickname: String(match.nickname) };
        }
        if (input.nickname?.trim()) await db.updateUserProfile(ctx.user.id, { name: input.nickname.trim() });
        return { ok: true, matched: false, nickname: input.nickname?.trim() ?? null };
      }),

    /** 시즌코드 입력 (기존 멤버 — 새 시즌 활성화) */
    enterSeasonCode: protectedProcedure
      .input(z.object({ seasonCode: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const season = await db.getActiveSeason();
        if (!(await entryCode.entryCodeOk(input.seasonCode)) && !entryCodeMatches(input.seasonCode, season?.seasonCode)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "입장코드가 올바르지 않아요. 방장에게 다시 확인해 주세요." });
        }
        if (season) await db.grantSeasonToken(ctx.user.id, season.id);
        return { ok: true };
      }),

    /** 현재 시즌 접근 권한 확인 */
    seasonAccess: protectedProcedure.query(async ({ ctx }) => {
      const season = await db.getActiveSeason();
      if (!season) return { hasAccess: true, season: null }; // 시즌 없으면 통과
      if (ctx.user.role === "admin" || ctx.user.status === "approved") return { hasAccess: true, season }; // 2026-11-21: 코드는 처음 입장할 때만
      const token = await db.getSeasonToken(ctx.user.id, season.id);
      return { hasAccess: !!token, season };
    }),
  }),
  invitations: invitationsRouter,
  members: membersRouter,
  weights: weightsRouter,
  goals: goalsRouter,
  meals: mealsRouter,
  exercises: exercisesRouter,
  feed: feedRouter,
  reactions: reactionsRouter,
  comments: commentsRouter,
  admin: adminRouter,
  seasons: seasonsRouter,
  sleep: sleepRouter,
  waters: watersRouter,
  happy: happyRouter,
  rounds: roundsRouter,
  crew: crewRouter,
  itge: itgeRouter,
  wellness: wellnessRouter,
});

export type AppRouter = typeof appRouter;
export { NOT_APPROVED_ERR_MSG };
