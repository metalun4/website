export function safePdfUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || raw.length > 2048 || !/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
