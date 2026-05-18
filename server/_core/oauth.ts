import type { Express } from "express";

// Auth is now handled via Supabase — no server-side OAuth routes needed.
export function registerOAuthRoutes(_app: Express) {}
