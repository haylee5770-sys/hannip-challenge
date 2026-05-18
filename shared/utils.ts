/**
 * Format a Date as YYYY-MM-DD using the local timezone.
 * Used for "today's date" semantics across the app — never UTC.
 */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal(): string {
  return formatLocalDate(new Date());
}

/** Format display name for daily reports — falls back to email or "이름 없음". */
export function displayName(user: { name?: string | null; email?: string | null }): string {
  return user.name?.trim() || user.email?.split("@")[0] || "이름 없음";
}
