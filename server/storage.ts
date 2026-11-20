import { createClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

function getSupabase() {
  return createClient(ENV.supabaseUrl, ENV.supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Supabase 무료판은 일주일 동안 활동이 없으면 자동으로 일시정지된다.
 * 서버가 하루 두 번 가볍게 조회해서 잠들지 않게 한다.
 */
export async function pingSupabase(): Promise<void> {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) return;
  const supabase = getSupabase();
  const bucket = process.env.SUPABASE_BUCKET || "uploads";
  try {
    const [files, users] = await Promise.all([
      supabase.storage.from(bucket).list("", { limit: 1 }),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
    ]);
    console.log(
      "[keepalive] supabase ok",
      files.error ? `storage err: ${files.error.message}` : "storage ok",
      users.error ? `auth err: ${users.error.message}` : "auth ok",
    );
  } catch (e: any) {
    console.warn("[keepalive] supabase ping failed:", e?.message ?? String(e));
  }
}

export function startSupabaseKeepAlive() {
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  setTimeout(() => void pingSupabase(), 60 * 1000);
  setInterval(() => void pingSupabase(), TWELVE_HOURS);
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const supabase = getSupabase();
  const key = appendHashSuffix(normalizeKey(relKey));

  const buffer =
    typeof data === "string"
      ? Buffer.from(data)
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data);

  const { error } = await supabase.storage
    .from(ENV.supabaseBucket)
    .upload(key, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(ENV.supabaseBucket)
    .getPublicUrl(key);

  return { key, url: urlData.publicUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const supabase = getSupabase();
  const key = normalizeKey(relKey);
  const { data } = supabase.storage.from(ENV.supabaseBucket).getPublicUrl(key);
  return { key, url: data.publicUrl };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const supabase = getSupabase();
  const key = normalizeKey(relKey);
  const { data, error } = await supabase.storage
    .from(ENV.supabaseBucket)
    .createSignedUrl(key, 3600);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}
