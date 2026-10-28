"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { allowLogin, createSession, destroySession, hash, requireAdmin } from "@/lib/session";
import { db, configured, supabase } from "@/lib/storage";
import { safeReturnTo } from "@/lib/yks-navigation";

export type ActionState = { error?: string; success?: string; pin?: string; expiresAt?: string; field?: "pin" | "password" };
const errorText = (error: unknown) => error instanceof Error ? error.message : "İşlem başarısız.";
const uuid = (value: FormDataEntryValue | null) => {
  const id = String(value ?? "");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new Error("Geçersiz kayıt.");
  return id;
};

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  if (!configured()) return { error: "Önce Supabase kurulumu ve ortam değişkenleri tamamlanmalı. README dosyasındaki adımları izleyin." };
  try {
    if (!await allowLogin()) return { error: "Çok fazla deneme. 15 dakika sonra tekrar deneyin." };
    if (form.get("mode") === "admin") {
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      if (!email || email.length > 254 || !password || password.length > 1024) return { error: "E-posta adresini ve şifreni kontrol et.", field: "password" };
      let user: { user: { id: string } };
      try {
        user = await supabase("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
      } catch { return { error: "E-posta adresini ve şifreni kontrol et.", field: "password" }; }
      if (user.user.id !== process.env.ADMIN_USER_ID) return { error: "E-posta adresini ve şifreni kontrol et.", field: "password" };
      await createSession("admin");
    } else {
      const pin = String(form.get("pin") ?? "").trim();
      if (!/^\d{10}$/.test(pin)) return { error: "10 haneli PIN’i kontrol et. Erişim süresi dolduysa yöneticiden yeni PIN iste.", field: "pin" };
      const [record] = await db<{ id: string }[]>(`viewer_pins?pin_hash=eq.${hash(`pin:${pin}`)}&revoked=eq.false&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`);
      if (!record) return { error: "PIN geçersiz veya süresi dolmuş. PIN’i kontrol et veya yöneticiden yenisini iste.", field: "pin" };
      await createSession("viewer", record.id);
    }
  } catch { return { error: "Giriş yapılamadı. Veritabanı bağlantısını ve kurulumu kontrol edin." }; }
  redirect(safeReturnTo(form.get("returnTo")));
}

export async function logout() {
  await destroySession();
  redirect("/yks27/login");
}

export async function deleteExam(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try { await db(`exams?id=eq.${uuid(form.get("id"))}`, { method: "DELETE" }); }
  catch (error) { return { error: errorText(error) }; }
  revalidatePath("/yks27/tyt");
  revalidatePath("/yks27/tyt/dashboard");
  revalidatePath("/yks27/admin");
  return { success: "Kayıt silindi." };
}

export async function createPin(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const label = String(form.get("label") ?? "").trim();
    const days = Number(form.get("days"));
    if (!label || label.length > 100 || !Number.isInteger(days) || days < 1 || days > 365) throw new Error("Ad ve 1–365 gün arasında süre girin.");
    const pin = Array.from({ length: 10 }, () => randomInt(10)).join("");
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    await db("viewer_pins", { method: "POST", body: JSON.stringify({ label, pin_hash: hash(`pin:${pin}`), expires_at: expiresAt }) });
    revalidatePath("/yks27/admin");
    return { pin, expiresAt, success: "PIN yalnızca şimdi gösterilir. Sayfadan ayrılmadan önce kopyalayıp paylaşın." };
  } catch (error) { return { error: errorText(error) }; }
}

export async function revokePin(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try { await db(`viewer_pins?id=eq.${uuid(form.get("id"))}`, { method: "PATCH", body: JSON.stringify({ revoked: true }) }); }
  catch (error) { return { error: errorText(error) }; }
  revalidatePath("/yks27/admin");
  return { success: "PIN ve bu PIN ile açılan oturumlar iptal edildi." };
}
