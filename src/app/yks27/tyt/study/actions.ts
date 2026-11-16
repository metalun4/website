"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/storage";
import { isUuid } from "@/lib/topic-stats";
import { loadStudyCatalog } from "@/lib/topic-study";
import { isStudyDate, istanbulToday, parseStudyClearResult, parseStudySaveResult } from "@/lib/topic-study-view";

export type StudyActionState = { error?: string; success?: string; saved?: number; skipped?: number };

const saveError = "Kayıt doğrulanamadı. Sayfayı yenileyerek kaydı kontrol et; oturumun açıksa tekrar dene. Girdiğin tarih ve seçimler bu formda korunuyor.";

function completionDate(form: FormData): string | null {
  const value = form.get("completedOn");
  return form.getAll("completedOn").length === 1 && isStudyDate(value) && value <= istanbulToday() ? value : null;
}

function groupIds(form: FormData, name: string): string[] | null {
  const values = form.getAll(name);
  if (!values.length || values.some(value => typeof value !== "string" || !isUuid(value))) return null;
  return [...new Set((values as string[]).map(value => value.toLowerCase()))];
}

async function save(ids: string[], completedOn: string, overwrite: boolean, tokenHash: string): Promise<StudyActionState> {
  let result;
  try {
    result = parseStudySaveResult(await db("rpc/set_topic_group_study", {
      method: "POST",
      body: JSON.stringify({ target_groups: ids, completed_on: completedOn, overwrite, admin_session_hash: tokenHash }),
    }));
    if (result.saved + result.skipped !== ids.length || (overwrite && result.saved !== ids.length)) throw new Error("Kayıt sayısı eşleşmedi.");
  } catch {
    return { error: saveError };
  }
  revalidatePath("/yks27", "layout");
  return { success: "Kayıt tamamlandı.", saved: result.saved, skipped: result.skipped };
}

export async function saveStudyGroup(_previous: StudyActionState, form: FormData): Promise<StudyActionState> {
  const admin = await requireAdmin();
  const ids = groupIds(form, "groupId");
  if (!ids || ids.length !== 1 || form.getAll("groupId").length !== 1) return { error: "Konu grubu doğrulanamadı. Sayfayı yenileyip tekrar seç." };
  const completedOn = completionDate(form);
  if (!completedOn) return { error: "Bitirdiğin tarihi gün, ay ve yıl olarak gir. Tarih, İstanbul’da bugünden sonra olamaz." };
  try {
    const catalog = await loadStudyCatalog();
    if (!catalog.groups.some(group => group.id.toLowerCase() === ids[0])) return { error: "Konu grubu bulunamadı. Sayfayı yenileyip tekrar seç." };
  } catch { return { error: saveError }; }
  return save(ids, completedOn, true, admin.token_hash);
}

export async function saveStudyGroups(_previous: StudyActionState, form: FormData): Promise<StudyActionState> {
  const admin = await requireAdmin();
  const ids = groupIds(form, "groupIds");
  if (!ids) return { error: "Bu dersten en az bir konu grubu seç. Geçersiz bir seçim varsa sayfayı yenile." };
  const completedOn = completionDate(form);
  if (!completedOn) return { error: "Bitirdiğin tarihi gün, ay ve yıl olarak gir. Tarih, İstanbul’da bugünden sonra olamaz." };
  try {
    const catalog = await loadStudyCatalog();
    const subjectId = form.get("subjectId");
    const allowed = new Set(catalog.groups.filter(group => group.subjectId === subjectId).map(group => group.id.toLowerCase()));
    if (form.getAll("subjectId").length !== 1 || ids.some(id => !allowed.has(id))) return { error: "Seçilen gruplar bu derste bulunamadı. Sayfayı yenileyip tekrar seç." };
  } catch { return { error: saveError }; }
  // A concurrent save may have marked a selected group. The RPC skips it atomically.
  return save(ids, completedOn, false, admin.token_hash);
}

export async function clearStudyGroup(_previous: StudyActionState, form: FormData): Promise<StudyActionState> {
  const admin = await requireAdmin();
  const ids = groupIds(form, "groupId");
  if (!ids || ids.length !== 1 || form.getAll("groupId").length !== 1) return { error: "Konu grubu doğrulanamadı. Sayfayı yenileyip tekrar seç." };
  let cleared;
  try {
    const catalog = await loadStudyCatalog();
    if (!catalog.groups.some(group => group.id.toLowerCase() === ids[0])) return { error: "Konu grubu bulunamadı. Sayfayı yenileyip tekrar seç." };
    const result = parseStudyClearResult(await db("rpc/clear_topic_group_study", {
      method: "POST", body: JSON.stringify({ target_group: ids[0], admin_session_hash: admin.token_hash }),
    }));
    if (result.groupId.toLowerCase() !== ids[0]) throw new Error("Konu grubu eşleşmedi.");
    cleared = result.cleared;
  } catch { return { error: saveError }; }
  revalidatePath("/yks27", "layout");
  return { success: cleared ? "İşlenme işareti kaldırıldı. İşlenme bilgisi eksik." : "Bu grupta zaten işlenme işareti yok. İşlenme bilgisi eksik." };
}
