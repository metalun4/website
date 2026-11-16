import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { parseCurriculum } from "../src/lib/topic-curriculum";
import type { ParsedExam } from "../src/lib/exam-import/types";

const migrationPath = "supabase/migrations/20261116120000_topic_group_study.sql";
type Group = { id: string; subject_id: string; name: string; display_order: number; completed_on: string | null };
type Catalog = {
  subjects: { id: string; name: string; parent_id: string | null; display_order: number }[];
  groups: Group[];
  exams: { id: string; name: string; exam_date: string }[];
};
type Bucket = "cancelled" | "unmapped" | "missing_completion" | "same_day" | "pre_study" | "post_study";
type Question = { id: string; bucket: Bucket; group_id: string | null; group_name: string | null; completed_on: string | null };
type Analysis = {
  status: "available" | "unavailable";
  reason?: "exam_not_found" | "incomplete_questions";
  exam_id: string | null;
  exam_date: string | null;
  has_study_records: boolean;
  counts: Record<Bucket, number> | null;
  post_study: { correct: number; wrong: number; blank: number } | null;
  questions?: Question[];
};
type Saved = { status: "saved"; saved: number; skipped: number };

async function rpc<T>(db: PGlite, sql: string, args: unknown[] = []): Promise<T> {
  return (await db.query<{ result: T }>(`select ${sql} result`, args)).rows[0].result;
}
const catalog = (db: PGlite) => rpc<Catalog>(db, "public.topic_study_catalog()");
const analysis = (db: PGlite, id: string | null, questions = true) => rpc<Analysis>(db, "public.tyt_study_analysis($1::uuid,$2::boolean)", [id, questions]);
const save = (db: PGlite, ids: (string | null)[] | null, date: string | null, overwrite: boolean | null = false, session: string | null = "study-admin") =>
  rpc<Saved>(db, "public.set_topic_group_study($1::uuid[],$2::date,$3::boolean,$4::text)", [ids, date, overwrite, session]);
const clear = (db: PGlite, id: string | null, session: string | null = "study-admin") =>
  rpc<{ status: "cleared"; group_id: string; cleared: boolean }>(db, "public.clear_topic_group_study($1::uuid,$2::text)", [id, session]);

async function setup(upgrade = false) {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const schema = (await readFile("supabase/schema.sql", "utf8")).replaceAll("\r\n", "\n");
    const migration = (await readFile(migrationPath, "utf8")).replaceAll("\r\n", "\n");
    assert.ok(schema.endsWith(migration), "Canonical schema ends with the exact additive migration");
    await db.exec(upgrade ? schema.slice(0, schema.length - migration.length) : schema);
    await db.exec(`
      insert into public.app_sessions values ('study-admin','admin',null,now()+interval '1 hour');
      insert into public.app_sessions values ('study-expired','admin',null,now()-interval '1 hour');
      insert into public.viewer_pins(label,pin_hash,expires_at) values ('Study viewer','study-pin',now()+interval '1 day');
      insert into public.app_sessions select 'study-viewer','viewer',id,now()+interval '1 hour' from public.viewer_pins;
      set role service_role;
    `);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

// Use checked-in parsed data, so these database tests need no PDF or network.
// Only fixture labels/outcomes change; import validates every official total.
async function importExam(db: PGlite, date = "2020-11-12", name = `Study ${date}`) {
  const [report] = JSON.parse(await readFile("tests/fixtures/tyt/goldens.json", "utf8")) as ParsedExam[];
  report.exam.name = name;
  report.exam.exam_date = date;
  report.exam.report_generated_at = "2020-11-20T12:00:00";
  for (const q of report.questions) q.topic_label = `Study unknown ${q.subject_id} ${q.question_number}`;
  const change = (subject: string, number: number, label: string, selected: string | null, correct = "A") => {
    const q = report.questions.find(q => q.subject_id === subject && q.question_number === number);
    assert.ok(q);
    q.topic_label = label;
    q.correct_answer = correct as typeof q.correct_answer;
    q.selected_answer = selected as typeof q.selected_answer;
  };
  change("tyt_math", 1, "Kümeler", "B");
  change("tyt_math", 2, "Kümeler", null);
  change("tyt_math", 3, "Kümeler", "A");
  change("tyt_math", 4, "Mantık", "B");
  change("tyt_math", 5, "Temel kavramlar", "B");
  change("tyt_math", 6, "Sayı kümeleri", "B");
  change("tyt_math", 8, "Kümeler", null, "İPTAL");
  change("tyt_math", 9, "Study cancelled unmapped", null, "İPTAL");
  change("tyt_math", 10, "Mantık", null, "İPTAL");
  change("tyt_biology", 15, "Mitoz Bölünme", "B");
  change("tyt_biology", 16, "Eşeysiz Üreme", null);
  change("tyt_biology", 17, "Mayoz Bölünme", "B");
  const totals = (questions: typeof report.questions) => {
    const correct = questions.filter(q => q.correct_answer === "İPTAL" || q.correct_answer === q.selected_answer).length;
    const wrong = questions.filter(q => q.correct_answer !== "İPTAL" && q.selected_answer !== null && q.correct_answer !== q.selected_answer).length;
    const blank = questions.filter(q => q.correct_answer !== "İPTAL" && q.selected_answer === null).length;
    return { correct, wrong, blank, net: correct - wrong / 4 };
  };
  const overall = totals(report.questions);
  Object.assign(report.exam, { total_correct: overall.correct, total_wrong: overall.wrong, total_blank: overall.blank, total_net: overall.net });
  const aggregate: Record<string, string[]> = {
    tyt_social: ["tyt_history", "tyt_geography", "tyt_philosophy", "tyt_religion"],
    tyt_math: ["tyt_math", "tyt_geometry"],
    tyt_science: ["tyt_physics", "tyt_chemistry", "tyt_biology"],
  };
  for (const subject of report.subjects) {
    const ids = subject.result_scope === "aggregate" ? aggregate[subject.subject_id] : [subject.subject_id];
    const counts = totals(report.questions.filter(q => ids.includes(q.subject_id)));
    Object.assign(subject, { correct_count: counts.correct, wrong_count: counts.wrong, blank_count: counts.blank, net: counts.net });
  }
  const imported = await rpc<{ status: string; exam_id: string }>(db, "public.import_tyt_exam($1::jsonb,'study-admin')", [JSON.stringify(report)]);
  assert.equal(imported.status, "imported");
  // A deliberately later import timestamp proves classification uses exam_date.
  await db.query("update public.exams set created_at='2020-11-20T12:00:00Z' where id=$1", [imported.exam_id]);
  return imported.exam_id;
}

function group(groups: Group[], name: string, subject = "tyt_math") {
  const found = groups.find(g => g.subject_id === subject && g.name === name);
  assert.ok(found, name);
  return found.id;
}
async function snapshot(db: PGlite) {
  // Compare canonical JSON text, including timestamps and every original field.
  return rpc<string>(db, `jsonb_build_object(
    'exams',(select jsonb_agg(to_jsonb(e) order by e.id) from public.exams e),
    'questions',(select jsonb_agg(to_jsonb(q) order by q.id) from public.exam_questions q),
    'results',(select jsonb_agg(to_jsonb(r) order by r.exam_id,r.subject_id,r.result_scope) from public.exam_subject_results r),
    'rankings',(select jsonb_agg(to_jsonb(r) order by r.exam_id,r.scope) from public.exam_rankings r)
  )::text`);
}
function assertPartition(result: Analysis) {
  assert.equal(result.status, "available");
  assert.ok(result.counts && result.post_study && result.questions);
  assert.equal(Object.values(result.counts).reduce((a, b) => a + b, 0), 120);
  assert.equal(result.questions.length, 120);
  assert.equal(new Set(result.questions.map(q => q.id)).size, 120);
  for (const [bucket, count] of Object.entries(result.counts)) assert.equal(result.questions.filter(q => q.bucket === bucket).length, count);
  assert.equal(result.counts.post_study, result.post_study.correct + result.post_study.wrong + result.post_study.blank);
  for (const q of result.questions) assert.deepEqual(Object.keys(q).sort(), ["id", "bucket", "group_id", "group_name", "completed_on"].sort());
}

test("study analysis partitions every question by exam date, with shared group dates and immediate corrections", async () => {
  const db = await setup();
  try {
    const beforeExam = await importExam(db, "2020-11-08");
    const sameExam = await importExam(db, "2020-11-10");
    const afterExam = await importExam(db);
    const original = await snapshot(db);
    const groups = (await catalog(db)).groups;
    const sets = group(groups, "Kümeler");
    const mitosis = group(groups, "Mitoz bölünme ve eşeysiz üreme", "tyt_biology");
    assert.equal((await analysis(db, afterExam)).has_study_records, false);
    await save(db, [sets, mitosis], "2020-11-10");
    await save(db, [group(groups, "Temel kavramlar")], "2020-11-14");
    await save(db, [group(groups, "Sayı kümeleri")], "2020-11-12");
    const result = await analysis(db, afterExam);
    assertPartition(result);
    assert.equal(result.exam_id, afterExam);
    assert.equal(result.exam_date, "2020-11-12");
    assert.equal(result.has_study_records, true);
    assert.deepEqual(result.counts, { cancelled: 3, unmapped: 108, missing_completion: 2, same_day: 1, pre_study: 1, post_study: 5 });
    assert.deepEqual(result.post_study, { correct: 1, wrong: 2, blank: 2 });
    const setQuestions = result.questions!.filter(q => q.group_id === sets);
    assert.equal(setQuestions.length, 4);
    assert.equal(setQuestions.filter(q => q.bucket === "cancelled").length, 1, "Cancellation wins even with a known post-study date");
    const biology = result.questions!.filter(q => q.group_id === mitosis);
    assert.equal(biology.length, 2);
    assert.ok(biology.every(q => q.completed_on === "2020-11-10" && q.bucket === "post_study"));
    const meiosis = result.questions!.find(q => q.group_id === group(groups, "Mayoz bölünme ve eşeyli üreme", "tyt_biology"));
    assert.equal(meiosis?.completed_on, null);
    assert.equal(meiosis?.bucket, "missing_completion");
    const early = await analysis(db, beforeExam);
    const same = await analysis(db, sameExam);
    assertPartition(early);
    assertPartition(same);
    assert.equal(early.counts!.pre_study, 7, "Later import time cannot turn earlier exams into post-study questions");
    assert.equal(early.counts!.post_study, 0);
    assert.equal(same.counts!.same_day, 5);
    assert.equal(same.counts!.post_study, 0);
    const summary = await analysis(db, afterExam, false);
    const { questions: details, ...expectedSummary } = result;
    assert.ok(details);
    assert.deepEqual(summary, expectedSummary);
    await save(db, [sets], "2020-11-13", true);
    assert.equal((await analysis(db, afterExam)).counts!.pre_study, 4, "Correction affects the next read");
    assert.deepEqual(await clear(db, sets), { status: "cleared", group_id: sets, cleared: true });
    assert.equal((await analysis(db, afterExam)).counts!.missing_completion, 5);
    assert.equal((await clear(db, sets)).cleared, false, "Clearing an already unmarked group is idempotent");
    await save(db, [sets], "2020-11-10");
    const topicId = (await db.query<{ id: string }>("select id from public.topics where subject_id='tyt_math' and name='Kümeler'")).rows[0].id;
    await db.query("select public.assign_topic_group($1,$2,'study-admin')", [topicId, group(groups, "Mantık")]);
    assert.equal((await analysis(db, afterExam)).counts!.missing_completion, 5, "Remapping uses the destination group's current completion information");
    assert.equal(await snapshot(db), original, "Study writes and remapping leave exam records, answers, totals and links byte-identical");
  } finally { await db.close(); }
});

test("catalog preserves all seeded groups and exam order; a single post-study miss has no sample gate", async () => {
  const db = await setup();
  try {
    const first = await importExam(db, "2020-11-08");
    const last = await importExam(db, "2020-11-15");
    const middle = await importExam(db, "2020-11-10");
    const c = await catalog(db);
    const curriculum = parseCurriculum(await readFile("data/tyt-curriculum.md", "utf8"));
    const subjectOrder = new Map(c.subjects.map(s => [s.id, s.display_order]));
    curriculum.sort((a, b) => subjectOrder.get(a.subjectId)! - subjectOrder.get(b.subjectId)! || a.displayOrder - b.displayOrder);
    assert.equal(c.groups.length, 154);
    assert.deepEqual(c.groups.map(g => ({ subjectId: g.subject_id, name: g.name, displayOrder: g.display_order })), curriculum);
    assert.ok(c.groups.every(g => g.completed_on === null));
    assert.deepEqual(c.exams, [
      { id: first, name: "Study 2020-11-08", exam_date: "2020-11-08" },
      { id: middle, name: "Study 2020-11-10", exam_date: "2020-11-10" },
      { id: last, name: "Study 2020-11-15", exam_date: "2020-11-15" },
    ]);
    const unused = group(c.groups, "Permütasyon ve kombinasyon");
    assert.equal((await db.query("select 1 from public.topics where group_id=$1", [unused])).rows.length, 0);
    await save(db, [unused], "2020-11-01");
    assert.equal((await catalog(db)).groups.find(g => g.id === unused)?.completed_on, "2020-11-01");
    const basic = group(c.groups, "Temel kavramlar");
    await save(db, [basic], "2020-11-10");
    const result = await analysis(db, last);
    assertPartition(result);
    assert.deepEqual(result.post_study, { correct: 0, wrong: 1, blank: 0 });
    assert.equal(result.questions!.filter(q => q.bucket === "post_study").length, 1);
    await clear(db, basic);
    const noEligible = await analysis(db, last);
    assertPartition(noEligible);
    assert.equal(noEligible.counts!.post_study, 0);
    assert.deepEqual(noEligible.post_study, { correct: 0, wrong: 0, blank: 0 });
    await clear(db, unused);
    assert.equal((await analysis(db, last)).has_study_records, false);
  } finally { await db.close(); }
});

test("bulk saves deduplicate IDs, preserve existing dates, maintain timestamps and reject invalid batches atomically", async () => {
  const db = await setup();
  try {
    const ids = (await catalog(db)).groups.filter(g => g.subject_id === "tyt_math").slice(0, 20).map(g => g.id);
    assert.equal(ids.length, 20);
    assert.deepEqual(await save(db, ids, "2020-11-01"), { status: "saved", saved: 20, skipped: 0 });
    const rows = () => db.query<{ group_id: string; completed_on: string; created_at: string; updated_at: string }>("select group_id,completed_on::text,created_at::text,updated_at::text from public.topic_group_study order by group_id");
    const initial = (await rows()).rows;
    assert.ok(initial.every(r => r.completed_on === "2020-11-01" && r.created_at === r.updated_at));
    const extra = (await catalog(db)).groups.find(g => g.subject_id === "tyt_math" && !ids.includes(g.id))!.id;
    assert.deepEqual(await save(db, [...ids, extra, extra], "2020-11-02"), { status: "saved", saved: 1, skipped: 20 });
    assert.deepEqual((await rows()).rows.filter(r => ids.includes(r.group_id)), initial, "Skipped rows retain dates and timestamps");
    await save(db, [ids[0]], "2020-11-03", true);
    const edited = (await rows()).rows.find(r => r.group_id === ids[0])!;
    assert.equal(edited.completed_on, "2020-11-03");
    assert.equal(edited.created_at, initial.find(r => r.group_id === ids[0])!.created_at);
    assert.equal(await rpc<boolean>(db, "(select updated_at>created_at from public.topic_group_study where group_id=$1)", [ids[0]]), true);
    const beforeInvalid = (await rows()).rows;
    const unused = (await db.query<{ id: string }>(`select g.id from public.topic_groups g
      where not (g.id=any($1::uuid[]))
        and not exists(select 1 from public.topic_aliases a where a.group_id=g.id)
      order by g.id limit 1`, [[...ids, extra]])).rows[0].id;
    const unknown = "00000000-0000-0000-0000-000000000000";
    const tomorrow = await rpc<string>(db, "((now() at time zone 'Europe/Istanbul')::date+1)::text");
    for (const invalid of [
      () => save(db, [unused, unknown], "2020-11-01"),
      () => save(db, [ids[0], unused, unknown], "2020-11-04", true),
      () => save(db, [unused, null], "2020-11-01"),
      () => save(db, [ids[0], unused], tomorrow, true),
      () => save(db, [unused], null),
      () => save(db, [], "2020-11-01"),
      () => save(db, null, "2020-11-01"),
      () => save(db, [unused], "2020-11-01", null),
    ]) {
      await assert.rejects(invalid);
      assert.deepEqual((await rows()).rows, beforeInvalid, "Invalid calls cannot partially insert or edit records");
    }
    const today = await rpc<string>(db, "(now() at time zone 'Europe/Istanbul')::date::text");
    assert.equal((await save(db, [unused], today)).saved, 1);
    const catalogBeforeDelete = await catalog(db);
    await assert.rejects(db.query("delete from public.topic_groups where id=$1", [unused]), /topic_group_study_group_id_fkey/);
    assert.deepEqual(await catalog(db), catalogBeforeDelete);
  } finally { await db.close(); }
});

test("Istanbul today is accepted at 01:00 while tomorrow is rejected, even with a UTC server", async () => {
  const db = await setup();
  try {
    const id = (await catalog(db)).groups[0].id;
    await db.exec("begin; reset role; set time zone 'UTC';");
    // Replace only this disposable database's clock inside a rolled-back
    // transaction, so the midnight boundary is deterministic on every test run.
    await db.exec("create or replace function pg_catalog.now() returns timestamptz language sql stable as $$ select '2020-11-10 22:00:00+00'::timestamptz $$; set role service_role;");
    assert.equal(await rpc<string>(db, "(now() at time zone 'UTC')::date::text"), "2020-11-10");
    assert.equal(await rpc<string>(db, "(now() at time zone 'Europe/Istanbul')::date::text"), "2020-11-11");
    assert.equal((await save(db, [id], "2020-11-11")).saved, 1);
    await db.exec("savepoint tomorrow");
    await assert.rejects(save(db, [id], "2020-11-12", true), /INVALID_COMPLETION_DATE/);
    await db.exec("rollback to savepoint tomorrow");
    assert.equal((await catalog(db)).groups.find(g => g.id === id)?.completed_on, "2020-11-11");
    await db.exec("rollback");
  } finally { await db.close(); }
});

test("study RPC and table privileges deny browser roles and invalid, expired or viewer write sessions", async () => {
  const db = await setup();
  try {
    const id = (await catalog(db)).groups[0].id;
    for (const session of [null, "", "invalid", "study-viewer", "study-expired"]) {
      await assert.rejects(save(db, [id], "2020-11-01", false, session), /ADMIN_REQUIRED/);
      await assert.rejects(clear(db, id, session), /ADMIN_REQUIRED/);
    }
    assert.ok((await catalog(db)).groups.every(g => g.completed_on === null));
    const functions = ["public.topic_study_catalog()", "public.set_topic_group_study(uuid[],date,boolean,text)", "public.clear_topic_group_study(uuid,text)", "public.tyt_study_analysis(uuid,boolean)"];
    for (const name of functions) {
      const metadata = (await db.query<{ prosecdef: boolean; proconfig: string[] }>("select prosecdef,proconfig from pg_proc where oid=$1::regprocedure", [name])).rows[0];
      assert.equal(metadata.prosecdef, false);
      assert.ok(metadata.proconfig.includes('search_path=""'));
    }
    assert.equal(await rpc<boolean>(db, "(select relrowsecurity from pg_class where oid='public.topic_group_study'::regclass)"), true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role}`);
      await assert.rejects(catalog(db), /permission denied/);
      await assert.rejects(analysis(db, null), /permission denied/);
      await assert.rejects(save(db, [id], "2020-11-01"), /permission denied/);
      await assert.rejects(clear(db, id), /permission denied/);
      await assert.rejects(db.query("select * from public.topic_group_study"), /permission denied/);
      await assert.rejects(db.query("insert into public.topic_group_study(group_id,completed_on) values($1,'2020-11-01')", [id]), /permission denied/);
      await assert.rejects(db.query("update public.topic_group_study set completed_on='2020-11-02'"), /permission denied/);
      await assert.rejects(db.query("delete from public.topic_group_study"), /permission denied/);
    }
    await db.exec("reset role; set role service_role");
    await assert.rejects(clear(db, "00000000-0000-0000-0000-000000000000"), /GROUP_NOT_FOUND/);
    await assert.rejects(clear(db, null), /GROUP_NOT_FOUND/);
    assert.equal((await catalog(db)).groups.length, 154, "Authorized reads use the server's service-role boundary");
  } finally { await db.close(); }
});

test("additive upgrade preserves existing exams; missing and incomplete reports are explicitly unavailable", async () => {
  const db = await setup(true);
  try {
    const exam = await importExam(db);
    const before = await snapshot(db);
    const catalogBefore = (await db.query("select * from public.topic_groups order by id")).rows;
    await db.exec("reset role");
    await db.exec(await readFile(migrationPath, "utf8"));
    await db.exec("set role service_role");
    assert.equal(await snapshot(db), before);
    assert.deepEqual((await db.query("select * from public.topic_groups order by id")).rows, catalogBefore);
    assertPartition(await analysis(db, exam));
    for (const id of [null, "00000000-0000-0000-0000-000000000000"]) {
      assert.deepEqual(await analysis(db, id), { status: "unavailable", reason: "exam_not_found", exam_id: id, exam_date: null, has_study_records: false, counts: null, post_study: null });
    }
    const id = (await catalog(db)).groups[0].id;
    await save(db, [id], "2020-11-01");
    const unavailable = { status: "unavailable", reason: "incomplete_questions", exam_id: exam, exam_date: "2020-11-12", has_study_records: true, counts: null, post_study: null };
    await db.query("delete from public.exam_questions where id=(select id from public.exam_questions where exam_id=$1 limit 1)", [exam]);
    assert.deepEqual(await analysis(db, exam), unavailable);
    await db.query("delete from public.exam_questions where exam_id=$1", [exam]);
    assert.deepEqual(await analysis(db, exam, false), unavailable);
    const badInterval = await importExam(db, "2020-11-13");
    await db.query("update public.exam_questions set question_number=100 where exam_id=$1 and subject_id='tyt_math' and question_number=1", [badInterval]);
    assert.equal((await analysis(db, badInterval)).reason, "incomplete_questions", "Matching total row count alone cannot make malformed numbering usable");
  } finally { await db.close(); }
});

test("isolated adapter executes all four real study RPCs with UUID arrays, dates and booleans", async () => {
  const { createIsolatedAdapter } = await import("../scripts/isolated-adapter.mjs");
  const isolated = await createIsolatedAdapter();
  try {
    await isolated.db.exec("insert into public.app_sessions values ('study-admin','admin',null,now()+interval '1 hour')");
    const call = async <T>(name: string, body: object) => {
      const response = await fetch(`${isolated.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST", headers: { apikey: isolated.key, "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      assert.equal(response.status, 200);
      return await response.json() as T;
    };
    const groups = (await call<Catalog>("topic_study_catalog", {})).groups;
    const args = { target_groups: groups.slice(0, 20).map(g => g.id), completed_on: "2020-11-10", overwrite: false, admin_session_hash: "study-admin" };
    assert.deepEqual(await call<Saved>("set_topic_group_study", args), { status: "saved", saved: 20, skipped: 0 });
    assert.deepEqual(await call<Saved>("set_topic_group_study", { ...args, completed_on: "2020-11-11" }), { status: "saved", saved: 0, skipped: 20 });
    assert.deepEqual(await call<Saved>("set_topic_group_study", { ...args, completed_on: "2020-11-11", overwrite: true }), { status: "saved", saved: 20, skipped: 0 });
    assert.equal((await call<Catalog>("topic_study_catalog", {})).groups[0].completed_on, "2020-11-11");
    const exam = await importExam(isolated.db);
    for (const include of [false, true]) {
      const result = await call<Analysis>("tyt_study_analysis", { target_exam: exam, include_questions: include });
      assert.deepEqual(result, await analysis(isolated.db, exam, include));
      assert.equal(Object.hasOwn(result, "questions"), include);
    }
    assert.deepEqual(await call("clear_topic_group_study", { target_group: groups[0].id, admin_session_hash: "study-admin" }), { status: "cleared", group_id: groups[0].id, cleared: true });
  } finally { await isolated.close(); }
});
