import "server-only";

export function configured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.ADMIN_USER_ID && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32);
}

export async function supabase<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!configured()) throw new Error("Supabase ortam değişkenlerini yapılandırın.");
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(10_000),
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Veritabanı isteği başarısız (${response.status}).`);
  const body = await response.text();
  return body ? JSON.parse(body) as T : undefined as T;
}

export const db = <T>(path: string, init?: RequestInit) => supabase<T>(`/rest/v1/${path}`, init);
