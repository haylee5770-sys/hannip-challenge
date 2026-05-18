import { createClient } from "@supabase/supabase-js";
import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type AuthenticatedUser = User;

function getSupabase() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(ENV.supabaseUrl, ENV.supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw ForbiddenError("Missing authorization header");
  }

  const token = authHeader.slice(7);
  console.log("[auth] step1: calling supabase.auth.getUser...");
  const supabase = getSupabase();
  const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
  console.log("[auth] step2: supabase.auth.getUser done, error=", error?.message ?? "none", "user=", supabaseUser?.id ?? "null");

  if (error || !supabaseUser) {
    throw ForbiddenError("Invalid or expired token");
  }

  const supabaseId = supabaseUser.id;
  const now = new Date();

  console.log("[auth] step3: looking up user in DB...");
  let user = await db.getUserByOpenId(supabaseId);
  console.log("[auth] step4: DB lookup done, found=", !!user);

  if (!user) {
    const isOwner = ENV.ownerEmail && supabaseUser.email === ENV.ownerEmail;
    await db.upsertUser({
      openId: supabaseId,
      name:
        supabaseUser.user_metadata?.full_name ??
        supabaseUser.user_metadata?.name ??
        supabaseUser.email?.split("@")[0] ??
        "User",
      email: supabaseUser.email ?? null,
      loginMethod: supabaseUser.app_metadata?.provider ?? "email",
      lastSignedIn: now,
      role: isOwner ? "admin" : "user",
      status: isOwner ? "approved" : "pending",
    });
    user = await db.getUserByOpenId(supabaseId);
  } else if (
    ENV.ownerEmail &&
    user.email === ENV.ownerEmail &&
    (user.role !== "admin" || user.status !== "approved")
  ) {
    await db.upsertUser({
      openId: supabaseId,
      role: "admin",
      status: "approved",
      lastSignedIn: now,
    });
    user = await db.getUserByOpenId(supabaseId);
  } else {
    await db.upsertUser({ openId: supabaseId, lastSignedIn: now });
  }

  if (!user) throw ForbiddenError("User not found after sync");

  return user;
}

export const sdk = { authenticateRequest };
