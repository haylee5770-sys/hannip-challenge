import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Users — extended with membership status & invite tracking.
 * status: pending(대기) / approved(승인) / rejected(거절)
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  invitedByUserId: int("invitedByUserId"),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  // 온보딩 필드
  realName: text("realName"),
  phone: varchar("phone", { length: 32 }),
  joinPurpose: text("joinPurpose"),
  agreedToTerms: boolean("agreedToTerms").default(false).notNull(),
  onboardingDone: boolean("onboardingDone").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Invitations — admin issues invite tokens for closed signup.
 */
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  createdByUserId: int("createdByUserId").notNull(),
  note: text("note"),
  usedByUserId: int("usedByUserId"),
  usedAt: timestamp("usedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

/**
 * Weight entries — one per user per day (upsert semantics enforced in app).
 */
export const weights = mysqlTable("weights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recordedDate: date("recordedDate", { mode: "string" }).notNull(),
  weightKg: decimal("weightKg", { precision: 5, scale: 2 }).notNull(),
  skeletalMuscleKg: decimal("skeletalMuscleKg", { precision: 5, scale: 2 }),
  bodyFatPercent: decimal("bodyFatPercent", { precision: 5, scale: 2 }),
  inbodyPhotoKey: varchar("inbodyPhotoKey", { length: 512 }),
  inbodyPhotoUrl: text("inbodyPhotoUrl"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  byUserDate: index("weights_user_date_idx").on(t.userId, t.recordedDate),
}));

export type Weight = typeof weights.$inferSelect;
export type InsertWeight = typeof weights.$inferInsert;

/**
 * Goals — target weight per user.
 */
export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  startWeightKg: decimal("startWeightKg", { precision: 5, scale: 2 }).notNull(),
  targetWeightKg: decimal("targetWeightKg", { precision: 5, scale: 2 }).notNull(),
  targetDate: date("targetDate", { mode: "string" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;

/**
 * Meals — one per user/date/category. Nutrient amounts are user-input grams (water in ml).
 */
export const meals = mysqlTable("meals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recordedDate: date("recordedDate", { mode: "string" }).notNull(),
  category: mysqlEnum("category", ["breakfast", "lunch", "dinner", "snack", "regular", "smoothie"]).notNull(),
  description: text("description"),
  carbsG: int("carbsG").default(0).notNull(),
  proteinG: int("proteinG").default(0).notNull(),
  fatG: int("fatG").default(0).notNull(),
  vegetableG: int("vegetableG").default(0).notNull(),
  waterMl: int("waterMl").default(0).notNull(),
  aiComment: text("aiComment"),
  aiCommentAt: timestamp("aiCommentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  byUserDate: index("meals_user_date_idx").on(t.userId, t.recordedDate),
}));

export type Meal = typeof meals.$inferSelect;
export type InsertMeal = typeof meals.$inferInsert;

/**
 * Meal photos — multiple per meal, stored via storagePut.
 */
export const mealPhotos = mysqlTable("mealPhotos", {
  id: int("id").autoincrement().primaryKey(),
  mealId: int("mealId").notNull(),
  userId: int("userId").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  byMeal: index("mealPhotos_meal_idx").on(t.mealId),
}));

export type MealPhoto = typeof mealPhotos.$inferSelect;
export type InsertMealPhoto = typeof mealPhotos.$inferInsert;

/**
 * Exercises — workout records.
 */
export const exercises = mysqlTable("exercises", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recordedDate: date("recordedDate", { mode: "string" }).notNull(),
  kind: varchar("kind", { length: 128 }).notNull(),
  durationMin: int("durationMin").notNull(),
  intensity: mysqlEnum("intensity", ["low", "medium", "high"]).default("medium").notNull(),
  note: text("note"),
  photoKey: varchar("photoKey", { length: 512 }),
  photoUrl: text("photoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  byUserDate: index("exercises_user_date_idx").on(t.userId, t.recordedDate),
}));

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = typeof exercises.$inferInsert;

/**
 * Reactions — emoji/like on a feed item (meal/exercise/weight).
 */
export const reactions = mysqlTable("reactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  targetType: mysqlEnum("targetType", ["meal", "exercise", "weight"]).notNull(),
  targetId: int("targetId").notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  byTarget: index("reactions_target_idx").on(t.targetType, t.targetId),
}));

export type Reaction = typeof reactions.$inferSelect;
export type InsertReaction = typeof reactions.$inferInsert;

/**
 * Comments — text feedback on a feed item.
 */
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  targetType: mysqlEnum("targetType", ["meal", "exercise", "weight"]).notNull(),
  targetId: int("targetId").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  byTarget: index("comments_target_idx").on(t.targetType, t.targetId),
}));

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/**
 * Scheduled jobs metadata — track admin-owned heartbeat crons.
 */
export const scheduledJobs = mysqlTable("scheduledJobs", {
  id: int("id").autoincrement().primaryKey(),
  jobKey: varchar("jobKey", { length: 64 }).notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  cronExpression: varchar("cronExpression", { length: 64 }),
  description: text("description"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type InsertScheduledJob = typeof scheduledJobs.$inferInsert;

/**
 * Seasons — 13-day challenge cycles. Only one can be active at a time (enforced in app).
 * status: upcoming(예정) / active(진행) / ended(종료)
 */
export const seasons = mysqlTable("seasons", {
  id: int("id").autoincrement().primaryKey(),
  seasonNumber: int("seasonNumber").notNull().default(1),
  totalDays: int("totalDays").notNull().default(13),
  name: varchar("name", { length: 128 }).notNull(),
  startDate: date("startDate", { mode: "string" }).notNull(),
  endDate: date("endDate", { mode: "string" }).notNull(),
  status: mysqlEnum("status", ["upcoming", "active", "ended"]).default("active").notNull(),
  seasonCode: varchar("seasonCode", { length: 64 }).notNull().default(""),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  byStatus: index("seasons_status_idx").on(t.status),
  byNumber: index("seasons_number_idx").on(t.seasonNumber),
}));

export type Season = typeof seasons.$inferSelect;
export type InsertSeason = typeof seasons.$inferInsert;

/**
 * Season participants — auto-enrolled the first time a member records a weight inside a season window.
 * baseline weight is captured on first record and used for loss% rankings throughout the season.
 */
export const seasonParticipants = mysqlTable("seasonParticipants", {
  id: int("id").autoincrement().primaryKey(),
  seasonId: int("seasonId").notNull(),
  userId: int("userId").notNull(),
  baselineWeightKg: decimal("baselineWeightKg", { precision: 5, scale: 2 }),
  baselineRecordedDate: date("baselineRecordedDate", { mode: "string" }),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
}, (t) => ({
  bySeasonUser: index("seasonParticipants_season_user_idx").on(t.seasonId, t.userId),
}));

export type SeasonParticipant = typeof seasonParticipants.$inferSelect;
export type InsertSeasonParticipant = typeof seasonParticipants.$inferInsert;

/**
 * Season photos — Before / Progress / After body photos for each season participant.
 * slot: before | progress | after — angle: front | side
 * Day 1 requires (before, front) + (before, side); Day 13 requires (after, front) + (after, side).
 * Multiple progress photos per day are allowed; before/after are unique per (seasonId, userId, slot, angle).
 */
export const seasonPhotos = mysqlTable("seasonPhotos", {
  id: int("id").autoincrement().primaryKey(),
  seasonId: int("seasonId").notNull(),
  userId: int("userId").notNull(),
  dayNumber: int("dayNumber").notNull(),
  slot: mysqlEnum("slot", ["before", "progress", "after"]).notNull(),
  angle: mysqlEnum("angle", ["front", "side"]).notNull(),
  photoKey: varchar("photoKey", { length: 512 }).notNull(),
  photoUrl: text("photoUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  bySeasonUser: index("seasonPhotos_season_user_idx").on(t.seasonId, t.userId),
  bySlot: index("seasonPhotos_slot_idx").on(t.seasonId, t.userId, t.slot),
}));

export type SeasonPhoto = typeof seasonPhotos.$inferSelect;
export type InsertSeasonPhoto = typeof seasonPhotos.$inferInsert;

/**
 * Season reports — auto-generated final report per (season, user) on Day 13 / season end.
 * isPublic = true means the public-facing community view exposes weight delta, counts, and reflection only.
 * Photos and meal details are NEVER exposed via the public view.
 */
export const seasonReports = mysqlTable("seasonReports", {
  id: int("id").autoincrement().primaryKey(),
  seasonId: int("seasonId").notNull(),
  userId: int("userId").notNull(),
  baselineWeightKg: decimal("baselineWeightKg", { precision: 5, scale: 2 }),
  finalWeightKg: decimal("finalWeightKg", { precision: 5, scale: 2 }),
  lossPercent: decimal("lossPercent", { precision: 6, scale: 3 }),
  finalSkeletalMuscleKg: decimal("finalSkeletalMuscleKg", { precision: 5, scale: 2 }),
  finalBodyFatPercent: decimal("finalBodyFatPercent", { precision: 5, scale: 2 }),
  weightCount: int("weightCount").default(0).notNull(),
  mealCount: int("mealCount").default(0).notNull(),
  exerciseCount: int("exerciseCount").default(0).notNull(),
  sleepCount: int("sleepCount").default(0).notNull(),
  waterCount: int("waterCount").default(0).notNull(),
  totalCount: int("totalCount").default(0).notNull(),
  participationScore: int("participationScore").default(0).notNull(),
  completed: boolean("completed").default(false).notNull(),
  reflection: text("reflection"),
  isPublic: boolean("isPublic").default(true).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  bySeasonUser: index("seasonReports_season_user_idx").on(t.seasonId, t.userId),
}));

export type SeasonReport = typeof seasonReports.$inferSelect;
export type InsertSeasonReport = typeof seasonReports.$inferInsert;


/**
 * Sleeps — one record per (user, recordedDate). bedAt/wakeAt are stored as ISO datetimes (UTC).
 * recordedDate is the *wake-up* date (즉, 오늘 아침 기상한 날짜) so that "어제 노력의 결과" 화면에서
 * 오늘 날짜로 한 행만 존재한다.
 */
export const sleeps = mysqlTable("sleeps", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recordedDate: date("recordedDate", { mode: "string" }).notNull(),
  bedAt: timestamp("bedAt").notNull(),
  wakeAt: timestamp("wakeAt").notNull(),
  durationMinutes: int("durationMinutes").notNull(),
  bedHour: int("bedHour").notNull(),
  bedMinute: int("bedMinute").notNull(),
  wakeHour: int("wakeHour").notNull(),
  wakeMinute: int("wakeMinute").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  byUserDate: index("sleeps_user_date_idx").on(t.userId, t.recordedDate),
}));

export type Sleep = typeof sleeps.$inferSelect;
export type InsertSleep = typeof sleeps.$inferInsert;

/**
 * Waters — 물 섭취 인증 레코드. 사진 1장 = 인증 1회, 용량은 ml 단위(300~1000, 100ml step).
 */
export const waters = mysqlTable("waters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recordedDate: date("recordedDate", { mode: "string" }).notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  volumeMl: int("volumeMl").notNull(),
  photoKey: varchar("photoKey", { length: 512 }).notNull(),
  photoUrl: text("photoUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  byUserDate: index("waters_user_date_idx").on(t.userId, t.recordedDate),
}));

export type Water = typeof waters.$inferSelect;
export type InsertWater = typeof waters.$inferInsert;

/**
 * Waist records — 시즌별 허리 둘레 비포/에프터 기록.
 */
export const waistRecords = mysqlTable("waistRecords", {
  id: int("id").autoincrement().primaryKey(),
  seasonId: int("seasonId").notNull(),
  userId: int("userId").notNull(),
  beforeCm: decimal("beforeCm", { precision: 5, scale: 1 }),
  afterCm: decimal("afterCm", { precision: 5, scale: 1 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  bySeasonUser: index("waistRecords_season_user_idx").on(t.seasonId, t.userId),
}));

export type WaistRecord = typeof waistRecords.$inferSelect;

/**
 * Season tokens — 시즌코드를 입력하고 활동 인증받은 기록. 시즌마다 새로 필요.
 */
export const seasonTokens = mysqlTable("seasonTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  seasonId: int("seasonId").notNull(),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
}, (t) => ({
  byUserSeason: index("seasonTokens_user_season_idx").on(t.userId, t.seasonId),
}));

export type SeasonToken = typeof seasonTokens.$inferSelect;

/**
 * App settings — 앱 전역 설정. 항상 id=1인 단일 행.
 */
export const appSettings = mysqlTable("appSettings", {
  id: int("id").autoincrement().primaryKey(),
  entryCode: varchar("entryCode", { length: 64 }).notNull().default(""),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;
