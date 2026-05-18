import type { Express } from "express";

// Storage is now via Supabase public URLs — no proxy needed.
export function registerStorageProxy(_app: Express) {}
