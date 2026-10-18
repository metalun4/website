import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { configured, db } from "./storage";

type Session = { token_hash: string; role: "admin" | "viewer"; pin_id: string | null; expires_at: string };
export type ViewerPin = { id: string; label: string; expires_at: string; revoked: boolean; created_at: string };
const cookieName = "yks_session";
export function hash(value: string) {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET eksik.");
  return createHmac("sha256", process.env.SESSION_SECRET).update(value).digest("hex");
}

export async function session() {
  if (!configured()) return null;
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [record] = await db<Session[]>(`app_sessions?token_hash=eq.${hash(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&limit=1`);
  if (!record) return null;
  if (record.role === "viewer") {
    const [pin] = await db<ViewerPin[]>(`viewer_pins?id=eq.${record.pin_id}&revoked=eq.false&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`);
    if (!pin) return null;
  }
  return record;
}

export async function requireSession() {
  const current = await session();
  if (!current) redirect("/yks27/login");
  return current;
}

export async function requireAdmin() {
  const current = await requireSession();
  if (current.role !== "admin") redirect("/yks27/tyt");
  return current;
}

export async function getAdminPins() {
  await requireAdmin();
  const pins = await db<ViewerPin[]>("viewer_pins?select=id,label,expires_at,revoked,created_at&order=created_at.desc");
  const now = Date.now();
  return pins.map(pin => ({ ...pin, status: pin.revoked ? "İptal edildi" : Date.parse(pin.expires_at) <= now ? "Süresi doldu" : "Aktif" }));
}

export async function createSession(role: Session["role"], pinId: string | null = null) {
  await destroySession();
  const token = randomBytes(32).toString("hex");
  const maxAge = role === "admin" ? 60 * 60 * 12 : 60 * 60 * 24;
  await db("app_sessions", { method: "POST", body: JSON.stringify({ token_hash: hash(token), role, pin_id: pinId, expires_at: new Date(Date.now() + maxAge * 1000).toISOString() }) });
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) await db(`app_sessions?token_hash=eq.${hash(token)}`, { method: "DELETE" });
  jar.delete(cookieName);
}

export async function allowLogin() {
  const h = await headers();
  // Vercel overwrites x-vercel-forwarded-for. Do not trust arbitrary forwarded headers.
  const ip = process.env.VERCEL ? h.get("x-vercel-forwarded-for") ?? "unknown" : "local";
  const perIp = await db<boolean>("rpc/consume_login_attempt", { method: "POST", body: JSON.stringify({ bucket: hash(`login:${ip}`), max_attempts: 10 }) });
  if (!perIp) return false;
  return db<boolean>("rpc/consume_login_attempt", { method: "POST", body: JSON.stringify({ bucket: hash("login:global"), max_attempts: 300 }) });
}
