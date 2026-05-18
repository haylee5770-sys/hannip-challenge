import { createClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

function getSupabase() {
  return createClient(ENV.supabaseUrl, ENV.supabaseServiceKey, {
    auth: { persistSession: false },
  });
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
