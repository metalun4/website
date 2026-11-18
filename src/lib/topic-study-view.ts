import { isUuid } from "./topic-stats";

export type StudySubject = { id: string; name: string; parentId: string | null; displayOrder: number };
export type StudyGroup = { id: string; subjectId: string; name: string; displayOrder: number; completedOn: string | null };
export type StudyExam = { id: string; name: string; examDate: string };
export type StudyCatalog = { subjects: StudySubject[]; groups: StudyGroup[]; exams: StudyExam[] };
export const studyBuckets = ["cancelled", "unmapped", "missing_completion", "same_day", "pre_study", "post_study"] as const;
export type StudyBucket = typeof studyBuckets[number];
export type StudyCounts = Record<StudyBucket, number>;
export type StudyQuestion = { id: string; bucket: StudyBucket; groupId: string | null; groupName: string | null; completedOn: string | null };
type StudyAnalysisBase = { examId: string; hasStudyRecords: boolean };
export type StudyAnalysis = StudyAnalysisBase & (
  | { status: "unavailable"; reason: "exam_not_found" | "incomplete_questions"; examDate: string | null; counts: null; postStudy: null }
  | { status: "available"; examDate: string; counts: StudyCounts; postStudy: { correct: number; wrong: number; blank: number }; questions?: StudyQuestion[] }
);
export type StudySaveResult = { status: "saved"; saved: number; skipped: number };
export type StudyClearResult = { status: "cleared"; groupId: string; cleared: boolean };

function invalid(): never { throw new Error("İşlenen konu verisi okunamadı. Sayfayı yenileyip tekrar dene."); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function payload(value: unknown) { return record(typeof value === "string" ? JSON.parse(value) as unknown : value); }
function rows(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid(); }
function text(value: unknown): string { return typeof value === "string" && value.trim() ? value : invalid(); }
function uuid(value: unknown): string { return typeof value === "string" && isUuid(value) ? value : invalid(); }
function integer(value: unknown): number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : invalid(); }
function bool(value: unknown): boolean { return typeof value === "boolean" ? value : invalid(); }
function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null { return value === null ? null : parse(value); }
function unique<T extends { id: string }>(items: T[]): T[] {
  if (new Set(items.map(item => item.id.toLowerCase())).size !== items.length) invalid();
  return items;
}

/** Calendar dates only: no timestamps, rollover dates, or locale-dependent parsing. */
export function isStudyDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function date(value: unknown): string { return isStudyDate(value) ? value : invalid(); }

export function istanbulToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatStudyDate(value: string): string {
  date(value);
  return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00+03:00`));
}

export function countExamsAroundDate(chosenDate: string, exams: readonly StudyExam[]): { after: number; on: number; before: number } {
  date(chosenDate);
  const counts = { after: 0, on: 0, before: 0 };
  for (const exam of exams) {
    date(exam.examDate);
    if (exam.examDate > chosenDate) counts.after++;
    else if (exam.examDate === chosenDate) counts.on++;
    else counts.before++;
  }
  return counts;
}

export function parseStudyCatalog(value: unknown): StudyCatalog {
  const p = payload(value);
  const subjects = unique(rows(p.subjects).map(item => {
    const s = record(item);
    return { id: text(s.id), name: text(s.name), parentId: nullable(s.parent_id, text), displayOrder: integer(s.display_order) };
  }));
  const subjectIds = new Set(subjects.map(s => s.id));
  if (subjects.some(s => s.parentId !== null && (!subjectIds.has(s.parentId) || s.parentId === s.id))) invalid();
  const groups = unique(rows(p.groups).map(item => {
    const g = record(item);
    const subjectId = text(g.subject_id);
    if (!subjectIds.has(subjectId)) invalid();
    return { id: uuid(g.id), subjectId, name: text(g.name), displayOrder: integer(g.display_order), completedOn: nullable(g.completed_on, date) };
  }));
  const exams = unique(rows(p.exams).map(item => {
    const e = record(item);
    return { id: uuid(e.id), name: text(e.name), examDate: date(e.exam_date) };
  }));
  return { subjects, groups, exams };
}

export function parseStudyAnalysis(value: unknown, includeQuestions?: boolean): StudyAnalysis {
  const p = payload(value);
  const base = { examId: uuid(p.exam_id), hasStudyRecords: bool(p.has_study_records) };
  if (p.status === "unavailable") {
    if (p.reason !== "exam_not_found" && p.reason !== "incomplete_questions") invalid();
    if (p.counts !== null || p.post_study !== null || p.questions !== undefined) invalid();
    const examDate = nullable(p.exam_date, date);
    if ((p.reason === "exam_not_found") !== (examDate === null)) invalid();
    return { ...base, status: "unavailable", reason: p.reason, examDate, counts: null, postStudy: null };
  }
  if (p.status !== "available") invalid();
  const examDate = date(p.exam_date);
  const rawCounts = record(p.counts);
  const counts = Object.fromEntries(studyBuckets.map(bucket => [bucket, integer(rawCounts[bucket])])) as StudyCounts;
  const post = record(p.post_study);
  const postStudy = { correct: integer(post.correct), wrong: integer(post.wrong), blank: integer(post.blank) };
  if (postStudy.correct + postStudy.wrong + postStudy.blank !== counts.post_study) invalid();
  const total = studyBuckets.reduce((sum, bucket) => sum + counts[bucket], 0);
  if (!Number.isSafeInteger(total) || total === 0) invalid();
  if (!base.hasStudyRecords && counts.same_day + counts.pre_study + counts.post_study !== 0) invalid();
  if (includeQuestions === true && p.questions === undefined) invalid();
  if (includeQuestions === false && p.questions !== undefined) invalid();
  const questions = p.questions === undefined ? undefined : unique(rows(p.questions).map(item => {
    const q = record(item);
    if (!studyBuckets.includes(q.bucket as StudyBucket)) invalid();
    const bucket = q.bucket as StudyBucket;
    const groupId = nullable(q.group_id, uuid);
    const groupName = nullable(q.group_name, text);
    const completedOn = nullable(q.completed_on, date);
    if ((groupId === null) !== (groupName === null) || (completedOn !== null && groupId === null)) invalid();
    if (bucket === "unmapped" && groupId !== null) invalid();
    if (bucket === "missing_completion" && (groupId === null || completedOn !== null)) invalid();
    if (["same_day", "pre_study", "post_study"].includes(bucket) && (groupId === null || completedOn === null)) invalid();
    return { id: uuid(q.id), bucket, groupId, groupName, completedOn };
  }));
  if (questions) {
    if (questions.length !== total) invalid();
    for (const bucket of studyBuckets) if (questions.filter(q => q.bucket === bucket).length !== counts[bucket]) invalid();
  }
  return { ...base, status: "available", examDate, counts, postStudy, ...(questions ? { questions } : {}) };
}

export function parseStudySaveResult(value: unknown): StudySaveResult {
  const p = payload(value);
  if (p.status !== "saved") invalid();
  return { status: "saved", saved: integer(p.saved), skipped: integer(p.skipped) };
}

export function parseStudyClearResult(value: unknown): StudyClearResult {
  const p = payload(value);
  if (p.status !== "cleared") invalid();
  return { status: "cleared", groupId: uuid(p.group_id), cleared: bool(p.cleared) };
}
