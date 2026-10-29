import "server-only";
import { db } from "../storage";
import type { ImportResult, ParsedExam, Topic } from "./types";

export const reportPayload = (r: ParsedExam) => ({ exam: r.exam, subjects: r.subjects, rankings: r.rankings, questions: r.questions });
export function previewImport(r: ParsedExam) {
  return db<{ status: "new" | "duplicate" | "collision"; exam_id: string | null; topics: Topic[]; unassigned_labels?: { subject_id: string; topic_label: string }[] }>("rpc/preview_tyt_import", { method: "POST", body: JSON.stringify({ payload: reportPayload(r) }) });
}
export function persistImport(r: ParsedExam, sessionHash: string) {
  return db<ImportResult>("rpc/import_tyt_exam", { method: "POST", body: JSON.stringify({ payload: reportPayload(r), admin_session_hash: sessionHash }) });
}
