"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/storage";
import { isUuid } from "@/lib/topic-stats";
import { topicSubjectAllowed } from "@/lib/topic-view";

function destination(form: FormData, notice: string, hash = "") {
  const params = new URLSearchParams();
  const subject = String(form.get("subject") ?? "");
  const q = String(form.get("q") ?? "").trim().slice(0, 100);
  if (topicSubjectAllowed(subject)) params.set("subject", subject);
  if (q) params.set("q", q);
  params.set("notice", notice);
  return `/yks27/admin/topics?${params.toString()}${hash}`;
}

function refresh() {
  revalidatePath("/yks27/admin/topics");
  revalidatePath("/yks27/tyt/topics");
}

async function write(path: string, args: Record<string, unknown>, form: FormData, success: string, hash: string) {
  const admin = await requireAdmin();
  try {
    await db(`rpc/${path}`, { method: "POST", body: JSON.stringify({ ...args, admin_session_hash: admin.token_hash }) });
  } catch {
    redirect(destination(form, "invalid", hash));
  }
  refresh();
  redirect(destination(form, success, hash));
}

export async function assignTopic(form: FormData) {
  await requireAdmin();
  const topicId = String(form.get("topicId") ?? "");
  const groupId = String(form.get("groupId") ?? "");
  const hash = isUuid(topicId) ? `#konu-${topicId}` : "";
  if (!isUuid(topicId) || !isUuid(groupId)) redirect(destination(form, "invalid", hash));
  if (form.get("confirm") !== "yes") redirect(destination(form, "confirm", hash));
  await write("assign_topic_group", { target_topic: topicId, target_group: groupId }, form, "saved", hash);
}

export async function clearTopicGroup(form: FormData) {
  await requireAdmin();
  const topicId = String(form.get("topicId") ?? "");
  const hash = isUuid(topicId) ? `#konu-${topicId}` : "";
  if (!isUuid(topicId)) redirect(destination(form, "invalid"));
  if (form.get("confirm") !== "yes") redirect(destination(form, "confirm", hash));
  await write("assign_topic_group", { target_topic: topicId, target_group: null }, form, "cleared", hash);
}

export async function saveTopicAlias(form: FormData) {
  await requireAdmin();
  const groupId = String(form.get("groupId") ?? "");
  const subjectId = String(form.get("subjectId") ?? "");
  const alias = String(form.get("alias") ?? "").trim();
  const hash = isUuid(groupId) ? `#grup-${groupId}` : "";
  if (!isUuid(groupId) || !topicSubjectAllowed(subjectId) || alias.length < 1 || alias.length > 300) redirect(destination(form, "invalid", hash));
  if (form.get("confirm") !== "yes") redirect(destination(form, "confirm", hash));
  await write("save_topic_alias", { target_alias: null, target_subject: subjectId, target_group: groupId, alias_text: alias }, form, "alias", hash);
}

export async function deleteTopicAlias(form: FormData) {
  await requireAdmin();
  const aliasId = String(form.get("aliasId") ?? "");
  const groupId = String(form.get("groupId") ?? "");
  const hash = isUuid(groupId) ? `#grup-${groupId}` : "";
  if (!isUuid(aliasId)) redirect(destination(form, "invalid", hash));
  if (form.get("confirm") !== "yes") redirect(destination(form, "confirm", hash));
  await write("delete_topic_alias", { target_alias: aliasId }, form, "alias-removed", hash);
}
