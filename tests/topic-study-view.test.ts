import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  countExamsAroundDate, formatStudyDate, isStudyDate, istanbulToday,
  parseStudyAnalysis, parseStudyCatalog, parseStudyClearResult, parseStudySaveResult,
  studyBuckets,
} from "../src/lib/topic-study-view";

const examId = "00000000-0000-0000-0000-000000000001";
const groupId = "00000000-0000-0000-0000-000000000002";
const catalog = () => ({
  subjects: [{ id: "tyt_math", name: "Matematik", parent_id: null, display_order: 7 }],
  groups: [{ id: groupId, subject_id: "tyt_math", name: "Kümeler", display_order: 1, completed_on: null }],
  exams: [{ id: examId, name: "Deneme", exam_date: "2026-11-10" }],
});
const detailedAnalysis = () => ({
  status: "available", exam_id: examId, exam_date: "2026-11-12", has_study_records: true,
  counts: { cancelled: 1, unmapped: 1, missing_completion: 1, same_day: 1, pre_study: 1, post_study: 3 },
  post_study: { correct: 1, wrong: 1, blank: 1 },
  questions: [...studyBuckets, "post_study", "post_study"].map((bucket, index) => ({
    id: `10000000-0000-0000-0000-${String(index).padStart(12, "0")}`, bucket,
    group_id: bucket === "unmapped" ? null : groupId,
    group_name: bucket === "unmapped" ? null : "Kümeler",
    completed_on: bucket === "unmapped" || bucket === "missing_completion" ? null : bucket === "same_day" ? "2026-11-12" : bucket === "pre_study" ? "2026-11-14" : "2026-11-10",
  })),
});

test("calendar dates reject rollover and timestamps, accepting historical and leap days", () => {
  for (const value of ["0001-01-01", "1900-02-28", "2000-02-29", "2024-02-29", "2026-11-10"]) assert.equal(isStudyDate(value), true, value);
  for (const value of [null, undefined, 20261110, "", "0000-01-01", "1900-02-29", "2026-02-29", "2026-04-31", "2026-00-10", "2026-13-01", "2026-01-00", "2026-1-01", "2026-11-10T00:00:00Z"]) assert.equal(isStudyDate(value), false, String(value));
  assert.equal(istanbulToday(new Date("2026-11-15T20:59:59Z")), "2026-11-15");
  assert.equal(istanbulToday(new Date("2026-11-15T21:00:00Z")), "2026-11-16");
  assert.equal(formatStudyDate("2026-11-10"), "10 Kasım 2026");
  assert.throws(() => formatStudyDate("2026-02-30"));
});

test("exam hint counts calendar days, including multiple same-day exams and empty lists", () => {
  const exams = ["2026-11-08", "2026-11-10", "2026-11-10", "2026-11-12", "2026-11-15"].map(examDate => ({ id: examDate, name: "Deneme", examDate }));
  const original = structuredClone(exams);
  assert.deepEqual(countExamsAroundDate("2026-11-10", exams), { after: 2, on: 2, before: 1 });
  assert.deepEqual(countExamsAroundDate("2000-01-01", exams), { after: 5, on: 0, before: 0 });
  assert.deepEqual(countExamsAroundDate("2026-11-16", exams), { after: 0, on: 0, before: 5 });
  assert.deepEqual(countExamsAroundDate("2026-11-10", []), { after: 0, on: 0, before: 0 });
  assert.deepEqual(exams, original);
  assert.throws(() => countExamsAroundDate("", exams));
  assert.throws(() => countExamsAroundDate("2026-11-10", [{ ...exams[0], examDate: "bad" }]));
});

test("catalog parser retains every group, nullable completion, chronology and curriculum order", () => {
  const raw = catalog();
  const parsed = parseStudyCatalog(JSON.stringify(raw));
  assert.deepEqual(parsed.groups, [{ id: groupId, subjectId: "tyt_math", name: "Kümeler", displayOrder: 1, completedOn: null }]);
  assert.deepEqual(parsed.exams, [{ id: examId, name: "Deneme", examDate: "2026-11-10" }]);
  assert.equal(parsed.subjects[0].parentId, null);
  assert.deepEqual(parseStudyCatalog({ subjects: [], groups: [], exams: [] }), { subjects: [], groups: [], exams: [] });
  const marked = { ...raw, groups: [{ ...raw.groups[0], completed_on: "2020-01-01" }] };
  assert.equal(parseStudyCatalog(marked).groups[0].completedOn, "2020-01-01");
  for (const value of [null, [], "null", "{", {}, { ...raw, groups: null }, { ...raw, groups: [null] },
    { ...raw, subjects: [{ ...raw.subjects[0], parent_id: false }] },
    { ...raw, subjects: [{ ...raw.subjects[0], parent_id: "missing" }] },
    { ...raw, subjects: [{ ...raw.subjects[0], display_order: "7" }] },
    { ...raw, groups: [raw.groups[0], raw.groups[0]] },
    { ...raw, groups: [{ ...raw.groups[0], id: "bad" }] },
    { ...raw, groups: [{ ...raw.groups[0], subject_id: "missing" }] },
    { ...raw, groups: [{ ...raw.groups[0], completed_on: undefined }] },
    { ...raw, groups: [{ ...raw.groups[0], completed_on: "2026-02-30" }] },
    { ...raw, exams: [{ ...raw.exams[0], exam_date: "2026-11-10T12:00:00Z" }] },
    { ...raw, exams: [{ ...raw.exams[0], name: " " }] },
  ]) assert.throws(() => parseStudyCatalog(value));
});

test("analysis parser preserves buckets and supports summary, detail and explicit unavailable states", () => {
  const raw = detailedAnalysis();
  const parsed = parseStudyAnalysis(JSON.stringify(raw), true);
  assert.equal(parsed.status, "available");
  if (parsed.status !== "available") throw new Error("Expected available analysis");
  assert.equal(parsed.questions?.length, 8);
  assert.equal(parsed.counts.post_study, 3);
  assert.deepEqual(parsed.postStudy, { correct: 1, wrong: 1, blank: 1 });
  assert.equal(parsed.questions?.[3].completedOn, "2026-11-12");
  const summary: Partial<typeof raw> = { ...raw };
  delete summary.questions;
  assert.equal("questions" in parseStudyAnalysis(summary, false), false);
  for (const [reason, exam_date] of [["exam_not_found", null], ["incomplete_questions", "2026-11-12"]] as const) {
    assert.deepEqual(parseStudyAnalysis({ status: "unavailable", reason, exam_id: examId, exam_date, has_study_records: false, counts: null, post_study: null }, true), {
      status: "unavailable", reason, examId, examDate: exam_date, hasStudyRecords: false, counts: null, postStudy: null,
    });
  }
  const noStudy = { ...summary, has_study_records: false, counts: { cancelled: 1, unmapped: 2, missing_completion: 5, same_day: 0, pre_study: 0, post_study: 0 }, post_study: { correct: 0, wrong: 0, blank: 0 } };
  assert.equal(parseStudyAnalysis(noStudy).status, "available");
});

test("malformed or inconsistent analysis never becomes empty or successful data", () => {
  const raw = detailedAnalysis();
  for (const value of [null, [], {}, { ...raw, status: "unknown" }, { ...raw, has_study_records: "true" },
    { ...raw, has_study_records: false }, { ...raw, exam_id: "bad" }, { ...raw, exam_date: null },
    { ...raw, counts: { ...raw.counts, post_study: -1 } },
    { ...raw, counts: { ...raw.counts, unmapped: "1" } },
    { ...raw, post_study: { correct: 0, wrong: 1, blank: 1 } },
    { ...raw, questions: raw.questions.slice(1) },
    { ...raw, questions: raw.questions.map(q => ({ ...q, id: examId })) },
    { ...raw, questions: [{ ...raw.questions[0], bucket: "unknown" }, ...raw.questions.slice(1)] },
    { ...raw, questions: raw.questions.map(q => ({ ...q, completed_on: undefined })) },
    { ...raw, questions: raw.questions.map(q => ({ ...q, group_name: null })) },
    { ...raw, questions: raw.questions.map(q => ({ ...q, bucket: "cancelled" })) },
    { status: "unavailable", reason: "unknown", exam_id: examId, exam_date: null, has_study_records: false, counts: null, post_study: null },
    { status: "unavailable", reason: "incomplete_questions", exam_id: examId, exam_date: null, has_study_records: false, counts: null, post_study: null },
    { status: "unavailable", reason: "exam_not_found", exam_id: examId, exam_date: null, has_study_records: false, counts: {}, post_study: null },
  ]) assert.throws(() => parseStudyAnalysis(value));
  assert.throws(() => parseStudyAnalysis(raw, false));
  const summary: Partial<typeof raw> = { ...raw };
  delete summary.questions;
  assert.throws(() => parseStudyAnalysis(summary, true));
});

test("write parsers require explicit successful results and typed counts/clear flags", () => {
  assert.deepEqual(parseStudySaveResult('{"status":"saved","saved":2,"skipped":1}'), { status: "saved", saved: 2, skipped: 1 });
  assert.deepEqual(parseStudyClearResult({ status: "cleared", group_id: groupId, cleared: false }), { status: "cleared", groupId, cleared: false });
  for (const value of [undefined, null, {}, { status: "error", saved: 0, skipped: 0 }, { status: "saved", saved: "1", skipped: 0 }, { status: "saved", saved: 1, skipped: -1 }]) assert.throws(() => parseStudySaveResult(value));
  for (const value of [null, {}, { status: "cleared", group_id: groupId, cleared: "false" }, { status: "cleared", group_id: "bad", cleared: true }]) assert.throws(() => parseStudyClearResult(value));
});

test("parsers consume the actual local SQL catalog and analysis outputs", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile("supabase/schema.sql", "utf8"));
    const rpc = async (sql: string, args: unknown[] = []) => (await db.query<{ result: unknown }>(`select ${sql} result`, args)).rows[0].result;
    const parsedCatalog = parseStudyCatalog(await rpc("public.topic_study_catalog()"));
    assert.equal(parsedCatalog.groups.length, 154);
    assert.equal(parseStudyAnalysis(await rpc("public.tyt_study_analysis($1::uuid,true)", [examId]), true).status, "unavailable");
    await db.exec("insert into public.app_sessions values ('study-parser-admin','admin',null,now()+interval '1 hour');");
    const [report] = JSON.parse(await readFile("tests/fixtures/tyt/goldens.json", "utf8")) as unknown[];
    const imported = await rpc("public.import_tyt_exam($1::jsonb,'study-parser-admin')", [JSON.stringify(report)]) as { exam_id: string };
    assert.equal(parseStudyAnalysis(await rpc("public.tyt_study_analysis($1::uuid,false)", [imported.exam_id]), false).status, "available");
    assert.equal(parseStudyAnalysis(await rpc("public.tyt_study_analysis($1::uuid,true)", [imported.exam_id]), true).status, "available");
    assert.equal(parseStudySaveResult(await rpc("public.set_topic_group_study($1::uuid[],'2020-01-01',false,'study-parser-admin')", [[parsedCatalog.groups[0].id]])).saved, 1);
    assert.equal(parseStudyClearResult(await rpc("public.clear_topic_group_study($1::uuid,'study-parser-admin')", [parsedCatalog.groups[0].id])).cleared, true);
  } finally { await db.close(); }
});
