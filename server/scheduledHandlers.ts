import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";
import { todayLocal } from "@shared/utils";

/**
 * Daily reminder handler — fires twice a day to nudge members about
 * weight / meals / exercise. Currently we route reminders to the project
 * owner via notifyOwner so the admin can fan-out, since per-user push
 * channels aren't available in this template.
 */
export async function dailyReminderHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }
    const job = await db.getScheduledJobByTaskUid(user.taskUid);
    if (!job) return res.json({ ok: true, skipped: "orphan" });

    const today = todayLocal();
    const approved = await db.listApprovedUsers();
    const ids = approved.map(u => u.id);

    const [meals, exercises, weights] = await Promise.all([
      db.listMealsForUsersOnDate(ids, today),
      db.listExercisesForUsersOnDate(ids, today),
      db.listWeightsForUsersOnDate(ids, today),
    ]);

    const mealsByUser = new Set(meals.map(m => m.userId));
    const exByUser = new Set(exercises.map(e => e.userId));
    const wByUser = new Set(weights.map(w => w.userId));

    const lines: string[] = [];
    for (const u of approved) {
      const missing: string[] = [];
      if (!wByUser.has(u.id)) missing.push("체중");
      if (!mealsByUser.has(u.id)) missing.push("식단");
      if (!exByUser.has(u.id)) missing.push("운동");
      if (missing.length === 0) continue;
      const name = u.name?.trim() || u.email?.split("@")[0] || "이름 없음";
      lines.push(`${name} : ${missing.join(", ")} 미수행`);
    }

    const slot = (job.description ?? "").toLowerCase().includes("evening") ? "저녁" : "오전";
    const title = `[Atelier Wellness] ${slot} 기록 리마인더 — ${today}`;
    const content = lines.length === 0
      ? `오늘 ${approved.length}명 모두 기록을 완료했어요. 훌륭해요!`
      : `다음 멤버들에게 기록 독려가 필요해요:\n\n${lines.join("\n")}`;

    await notifyOwner({ title, content });

    res.json({ ok: true, missingCount: lines.length });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    res.status(500).json({
      error,
      stack,
      context: { url: req.url, taskUid: (req.body as { taskUid?: string })?.taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
