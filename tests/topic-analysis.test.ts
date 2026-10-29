import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { normalizeTopic } from "../src/lib/exam-import/normalize";
import { parseCurriculum } from "../src/lib/topic-curriculum";
import { renderTopicMigration, topicMigrationPath } from "../src/lib/render-topic-migration";
import {
  combineTopics, compareTopics, readPerformance, topicMetrics, topicQuery,
  type CountedTopic,
} from "../src/lib/topic-stats";
import { buildTopicView, parseTopicAnalysis, type TopicAnalysis } from "../src/lib/topic-view";
import { fixtureReport } from "./fixtures";

const topic = (patch: Partial<CountedTopic> & Pick<CountedTopic, "id" | "name" | "examIds">): CountedTopic => ({
  subjectId: "tyt_math",
  groupId: "group",
  needsReview: false,
  counts: { valid: 0, correct: 0, wrong: 0, blank: 0, cancelled: 0 },
  ...patch,
});

test("topic metrics keep success, attempt, and accuracy distinct", () => {
  const blank = topicMetrics({ valid: 4, correct: 0, wrong: 0, blank: 4, cancelled: 1, exams: 2 });
  assert.equal(blank.success, 0);
  assert.equal(blank.attempt, 0);
  assert.equal(blank.accuracy, null);
  assert.equal(blank.net, 0);
  assert.equal(readPerformance(blank), "blank");
  const once = topicMetrics({ valid: 5, correct: 5, wrong: 0, blank: 0, cancelled: 0, exams: 1 });
  assert.equal(readPerformance(once), "insufficient");
  const strong = topicMetrics({ valid: 4, correct: 4, wrong: 0, blank: 0, cancelled: 0, exams: 2 });
  assert.equal(readPerformance(strong), "strong");
  assert.equal(strong.net, 4);
  const wrong = topicMetrics({ valid: 4, correct: 1, wrong: 3, blank: 0, cancelled: 0, exams: 2 });
  assert.equal(readPerformance(wrong), "wrong");
  assert.equal(wrong.net, 0.25);
  assert.equal(wrong.success, 0.25);
  assert.equal(wrong.accuracy, 0.25);
  assert.equal(readPerformance(topicMetrics({ valid: 0, correct: 0, wrong: 0, blank: 0, cancelled: 2, exams: 0 })), "empty");
  const shared = topic({ id: "a", name: "A", examIds: ["e1", "e2"], counts: { valid: 2, correct: 2, wrong: 0, blank: 0, cancelled: 0 } });
  const overlap = topic({ id: "b", name: "B", examIds: ["e2"], counts: { valid: 1, correct: 0, wrong: 1, blank: 0, cancelled: 0 } });
  const combined = combineTopics([shared, overlap]);
  assert.equal(combined.valid, 3);
  assert.equal(combined.exams, 2);
  assert.equal(combined.net, 1.75);
  assert.deepEqual(compareTopics("performance", { name: "Boş", metrics: topicMetrics({ valid: 0, correct: 0, wrong: 0, blank: 0, cancelled: 0, exams: 0 }) }, { name: "Dolu", metrics: wrong }) > 0, true);
  assert.equal(topicQuery({ range: "all", sort: "performance" }), "");
  assert.equal(topicQuery({ range: "5", subject: "tyt_math", q: "kök", sort: "name", topic: "abc" }), "?range=5&subject=tyt_math&q=k%C3%B6k&sort=name&topic=abc");
});

test("topic view totals count each question once and empty groups stay empty", () => {
  const analysis: TopicAnalysis = {
    examTotal: 2,
    exams: [{ id: "e1", name: "Bir", examDate: "2026-01-01" }, { id: "e2", name: "İki", examDate: "2026-01-02" }],
    subjects: [
      { id: "tyt_math", name: "Matematik", parentId: null, displayOrder: 7 },
      { id: "tyt_geometry", name: "Geometri", parentId: "tyt_math", displayOrder: 8 },
    ],
    groups: [
      { id: "g1", subjectId: "tyt_math", name: "Kümeler", displayOrder: 1 },
      { id: "g2", subjectId: "tyt_math", name: "Mantık", displayOrder: 2 },
      { id: "g3", subjectId: "tyt_geometry", name: "Çokgenler", displayOrder: 1 },
    ],
    topics: [
      topic({ id: "t1", name: "Kümelerde İşlemler", groupId: "g1", examIds: ["e1", "e2"], counts: { valid: 2, correct: 1, wrong: 1, blank: 0, cancelled: 0 } }),
      topic({ id: "t2", name: "İPTAL", subjectId: "tyt_math", groupId: null, examIds: [], counts: { valid: 0, correct: 0, wrong: 0, blank: 0, cancelled: 2 } }),
      topic({ id: "t3", name: "Çokgen", subjectId: "tyt_geometry", groupId: "g3", examIds: ["e1"], counts: { valid: 1, correct: 0, wrong: 0, blank: 1, cancelled: 0 } }),
    ],
  };
  const view = buildTopicView(analysis, { subjectId: "", query: "", sort: "performance" });
  const math = view.sections.flatMap(section => section.subjects).find(subject => subject.id === "tyt_math");
  assert.ok(math);
  assert.equal(math.metrics.valid, 2);
  assert.equal(math.metrics.cancelled, 2);
  assert.equal(math.groups.find(group => group.id === "g2")?.reading, "empty");
  assert.equal(math.groups.reduce((sum, group) => sum + group.metrics.valid, 0) + view.unassignedAll.filter(item => item.subjectId === "tyt_math").reduce((sum, item) => sum + item.counts.valid, 0), math.metrics.valid);
  assert.equal(view.overall.valid, 3);
  assert.equal(view.unassignedAll.map(item => item.name).join(), "İPTAL");
  const searched = buildTopicView(analysis, { subjectId: "tyt_math", query: "işlem", sort: "name" });
  assert.equal(searched.sections.flatMap(section => section.subjects).flatMap(subject => subject.groups).flatMap(group => group.topics).map(item => item.name).join(), "Kümelerde İşlemler");
  assert.equal(searched.overall.valid, 2);
});

test("curriculum seed, matching, aggregation, reclassification, and permissions", async () => {
  const [markdown, migration, rendered] = await Promise.all([
    readFile("data/tyt-curriculum.md", "utf8"),
    readFile(topicMigrationPath, "utf8"),
    renderTopicMigration(),
  ]);
  assert.equal(migration, rendered);
  const curriculum = parseCurriculum(markdown);
  assert.equal(curriculum.length, 154);
  const db = new PGlite();
  const call = async (report: unknown, session = "test-admin") => (await db.query<{ result: { status: string; exam_id: string; unassigned_topics: { name: string }[] } }>("select public.import_tyt_exam($1::jsonb,$2) result", [JSON.stringify(report), session])).rows[0].result;
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile("supabase/schema.sql", "utf8"));
    await db.exec("insert into public.viewer_pins(id,label,pin_hash,expires_at) values('00000000-0000-0000-0000-000000000001','Viewer','hash',now()+interval '1 day'); insert into public.app_sessions values ('test-admin','admin',null,now()+interval '1 hour'), ('test-viewer','viewer','00000000-0000-0000-0000-000000000001',now()+interval '1 hour');");
    const groups = await db.query<{ subject_id: string; name: string; display_order: number }>("select subject_id,name,display_order from public.topic_groups order by subject_id,display_order");
    assert.deepEqual(groups.rows, [...curriculum].sort((a, b) => a.subjectId.localeCompare(b.subjectId) || a.displayOrder - b.displayOrder).map(group => ({ subject_id: group.subjectId, name: group.name, display_order: group.displayOrder })));
    assert.equal(Number((await db.query<{ n: number }>("select count(*)::int n from public.topic_aliases")).rows[0].n), 260);
    const aliases = await db.query<{ alias: string }>("select alias from public.topic_aliases");
    for (const name of [...curriculum.map(group => group.name), ...aliases.rows.map(row => row.alias)]) {
      assert.equal((await db.query<{ value: string }>("select public.normalize_topic_label($1) value", [name])).rows[0].value, normalizeTopic(name), name);
    }
    const groupId = async (subject: string, name: string) => (await db.query<{ id: string }>("select id from public.topic_groups where subject_id=$1 and normalized_name=public.normalize_topic_label($2)", [subject, name])).rows[0].id;
    assert.equal(await groupId("tyt_turkish", "  PARAGRAFTA   ANLAM "), (await db.query<{ id: string | null }>("select public.resolve_topic_group('tyt_turkish','  PARAGRAFTA   ANLAM ') id")).rows[0].id);
    assert.equal((await db.query<{ id: string | null }>("select public.resolve_topic_group('tyt_math','Köklü İfadeler') id")).rows[0].id, await groupId("tyt_math", "Köklü sayılar"));
    assert.equal((await db.query<{ id: string | null }>("select public.resolve_topic_group('tyt_math','Tamamen yeni etiket') id")).rows[0].id, null);
    assert.equal((await db.query<{ id: string | null }>("select public.resolve_topic_group('tyt_philosophy','Mantık') id")).rows[0].id, null);
    assert.equal((await db.query<{ id: string | null }>("select public.resolve_topic_group('tyt_math','Mantık') id")).rows[0].id, await groupId("tyt_math", "Mantık"));
    assert.equal((await db.query<{ id: string | null }>("select public.resolve_topic_group('tyt_math','İPTAL') id")).rows[0].id, null);
    await db.exec("alter table public.topic_aliases disable trigger topic_alias_check");
    await db.query("insert into public.topic_aliases(subject_id,group_id,alias,normalized_name) select 'tyt_math', id, 'Kümeler', public.normalize_topic_label('Kümeler') from public.topic_groups where subject_id='tyt_math' and name='Olasılık'");
    assert.equal((await db.query<{ id: string | null }>("select public.resolve_topic_group('tyt_math','Kümeler') id")).rows[0].id, null);
    await db.query("delete from public.topic_aliases where subject_id='tyt_math' and alias='Kümeler'");
    await db.exec("alter table public.topic_aliases enable trigger topic_alias_check");
    assert.equal((await db.query<{ id: string | null }>("select public.resolve_topic_group('tyt_math','Kümeler') id")).rows[0].id, await groupId("tyt_math", "Kümeler"));
    await assert.rejects(db.query("insert into public.topic_aliases(subject_id,group_id,alias,normalized_name) select 'tyt_math', id, 'Mantık', public.normalize_topic_label('Mantık') from public.topic_groups where subject_id='tyt_math' and name='Olasılık'"), /ALIAS_MATCHES_GROUP/);

    await db.exec("set role service_role");
    const first = structuredClone(await fixtureReport());
    const imported = await call(first);
    assert.equal(imported.status, "imported");
    const mappedBefore = Number((await db.query<{ n: number }>("select count(*)::int n from public.topics where group_id is not null")).rows[0].n);
    assert.ok(mappedBefore > 0);
    const versions = (await db.query<{ id: string; version: string }>("select id,xmin::text as version from public.topics order by id")).rows;
    const second = structuredClone(first);
    second.exam.name = "Topic follow-up";
    second.exam.exam_date = "2026-12-15";
    const freshName = (await db.query<{ name: string }>("select g.name from public.topic_groups g where g.subject_id='tyt_math' and not exists (select 1 from public.topics t where t.subject_id=g.subject_id and t.normalized_name=g.normalized_name) order by g.display_order limit 1")).rows[0].name;
    const mathQuestion = second.questions.find(question => question.subject_id === "tyt_math" && question.correct_answer !== "İPTAL");
    const physicsQuestion = second.questions.find(question => question.subject_id === "tyt_physics");
    assert.ok(mathQuestion && physicsQuestion && freshName);
    mathQuestion.topic_label = freshName;
    physicsQuestion.topic_label = "Bilinmeyen fizik etiketi";
    const follow = await call(second);
    assert.equal(follow.status, "imported");
    assert.equal((await db.query<{ name: string }>("select g.name from public.topics t join public.topic_groups g on g.id=t.group_id where t.subject_id='tyt_math' and t.name=$1", [freshName])).rows[0].name, freshName);
    assert.equal((await db.query<{ id: string | null }>("select group_id id from public.topics where subject_id='tyt_physics' and name='Bilinmeyen fizik etiketi'")).rows[0].id, null);
    assert.ok(follow.unassigned_topics.some(topic => topic.name === "Bilinmeyen fizik etiketi"));
    assert.equal((await call(second)).status, "duplicate");
    assert.deepEqual((await db.query("select id,xmin::text as version from public.topics where id=any($1::uuid[]) order by id", [versions.map(row => row.id)])).rows, versions);
    await db.query("insert into public.topic_aliases(subject_id,group_id,alias,normalized_name) select 'tyt_physics', id, 'Bilinmeyen fizik etiketi', public.normalize_topic_label('Bilinmeyen fizik etiketi') from public.topic_groups where subject_id='tyt_physics' and name='Dalgalar'");
    const third = structuredClone(second);
    third.exam.name = "Alias must not relabel history";
    third.exam.exam_date = "2026-12-16";
    assert.equal((await call(third)).status, "imported");
    assert.equal((await db.query<{ id: string | null }>("select group_id id from public.topics where name='Bilinmeyen fizik etiketi'")).rows[0].id, null);
    const beforeRollback = Number((await db.query<{ n: number }>("select count(*)::int n from public.topics")).rows[0].n);
    const bad = structuredClone(third);
    bad.exam.name = "Rollback topic import";
    bad.exam.exam_date = "2026-12-17";
    bad.questions[0].topic_label = "Rollback yeni konu";
    bad.rankings[3].participant_count = 0;
    await assert.rejects(call(bad));
    assert.equal(Number((await db.query<{ n: number }>("select count(*)::int n from public.topics")).rows[0].n), beforeRollback);

    const topicRow = (await db.query<{ id: string; group_id: string }>("select id,group_id from public.topics where subject_id='tyt_math' and name=$1", [freshName])).rows[0];
    const questionTopic = (await db.query<{ topic_id: string }>("select topic_id from public.exam_questions where topic_id=$1 limit 1", [topicRow.id])).rows[0].topic_id;
    const other = await groupId("tyt_math", "Mantık");
    await db.query("select public.assign_topic_group($1,$2,'test-admin')", [topicRow.id, other]);
    assert.equal((await db.query<{ group_id: string }>("select group_id from public.topics where id=$1", [topicRow.id])).rows[0].group_id, other);
    assert.equal((await db.query<{ topic_id: string }>("select topic_id from public.exam_questions where topic_id=$1 limit 1", [topicRow.id])).rows[0].topic_id, questionTopic);
    const analysis = parseTopicAnalysis((await db.query<{ result: unknown }>("select public.tyt_topic_analysis(null) result")).rows[0].result);
    const moved = analysis.topics.find(item => item.id === topicRow.id);
    assert.equal(moved?.groupId, other);
    assert.ok((moved?.counts.valid ?? 0) > 0);
    const view = buildTopicView(analysis, { subjectId: "tyt_math", query: "", sort: "questions" });
    const destination = view.sections.flatMap(section => section.subjects).flatMap(subject => subject.groups).find(group => group.id === other);
    assert.ok(destination?.topics.some(item => item.id === topicRow.id));
    await assert.rejects(db.query("select public.assign_topic_group($1,$2,'test-admin')", [topicRow.id, await groupId("tyt_physics", "Dalgalar")]), /SUBJECT_MISMATCH/);
    await assert.rejects(db.query("select public.assign_topic_group($1,$2,'test-viewer')", [topicRow.id, other]), /ADMIN_REQUIRED/);

    await db.exec("reset role");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from public.topic_groups"), /permission denied/);
      await assert.rejects(db.query("select * from public.topic_aliases"), /permission denied/);
      await assert.rejects(db.query("select public.resolve_topic_group('tyt_math','Kümeler')"), /permission denied/);
      await assert.rejects(db.query("select public.assign_topic_group($1,$2,'test-admin')", [topicRow.id, other]), /permission denied/);
      await db.exec("reset role");
    }
    const secured = await db.query<{ relname: string; relrowsecurity: boolean }>("select relname,relrowsecurity from pg_class where oid in ('public.topic_groups'::regclass,'public.topic_aliases'::regclass)");
    assert.equal(secured.rows.length, 2);
    assert.ok(secured.rows.every(row => row.relrowsecurity));
    await db.exec(migration);
    assert.equal(Number((await db.query<{ n: number }>("select count(*)::int n from public.topic_groups")).rows[0].n), 154);
    assert.equal(Number((await db.query<{ n: number }>("select count(*)::int n from public.topic_aliases")).rows[0].n), 261);
  } finally { await db.close(); }
});

test("limited exam ranges and cancelled questions do not distort learning totals", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile("supabase/schema.sql", "utf8"));
    const insertExam = async (date: string, rows: { topic: string; group: string | null; correct: string; selected: string | null }[]) => {
      const correct = rows.filter(row => row.correct === "İPTAL" || row.selected === row.correct).length;
      const wrong = rows.filter(row => row.correct !== "İPTAL" && row.selected && row.selected !== row.correct).length;
      const blank = rows.filter(row => row.correct !== "İPTAL" && !row.selected).length;
      const net = correct - wrong / 4;
      const examId = (await db.query<{ id: string }>("insert into public.exams(exam_type,name,exam_date,total_questions,total_correct,total_wrong,total_blank,total_net) values('TYT',$1,$2,$3,$4,$5,$6,$7) returning id", [`Deneme ${date}`, date, rows.length, correct, wrong, blank, net])).rows[0].id;
      for (const [index, row] of rows.entries()) {
        const topicId = (await db.query<{ id: string }>(`insert into public.topics(subject_id,name,normalized_name,group_id)
          select 'tyt_math',$1,public.normalize_topic_label($1),(select id from public.topic_groups where subject_id='tyt_math' and name=$2)
          on conflict(subject_id,normalized_name) do update set name=public.topics.name returning id`, [row.topic, row.group])).rows[0].id;
        await db.query("insert into public.exam_questions(exam_id,question_number,subject_id,topic_id,correct_answer,selected_answer) values($1,$2,'tyt_math',$3,$4,$5)", [examId, index + 1, topicId, row.correct, row.selected]);
      }
    };
    for (let index = 0; index < 6; index += 1) {
      const date = `2026-01-${String(index + 1).padStart(2, "0")}`;
      const rows: { topic: string; group: string | null; correct: string; selected: string | null }[] = [{ topic: "Kümeler", group: "Kümeler", correct: "A", selected: index === 0 ? "B" : "A" }];
      if (index < 4) rows.push({ topic: "Yalnız boş", group: "Mantık", correct: "A", selected: null });
      if (index === 0) rows.push({ topic: "İptal etiketi", group: null, correct: "İPTAL", selected: null });
      await insertExam(date, rows);
    }
    const all = parseTopicAnalysis((await db.query<{ result: unknown }>("select public.tyt_topic_analysis(null) result")).rows[0].result);
    const recent = parseTopicAnalysis((await db.query<{ result: unknown }>("select public.tyt_topic_analysis(5) result")).rows[0].result);
    const sets = (await db.query<{ name: string }>("select name from public.exams where exam_type='TYT' order by exam_date desc,id desc limit 5")).rows.map(row => row.name).sort();
    assert.deepEqual(recent.exams.map(exam => exam.name).sort(), sets);
    const find = (analysis: TopicAnalysis, name: string) => analysis.topics.find(item => item.name === name);
    assert.equal(find(all, "Kümeler")?.counts.valid, 6);
    assert.equal(find(all, "Kümeler")?.counts.wrong, 1);
    assert.equal(find(recent, "Kümeler")?.counts.valid, 5);
    assert.equal(find(recent, "Kümeler")?.counts.wrong, 0);
    assert.equal(find(all, "İptal etiketi")?.counts.valid, 0);
    assert.equal(find(all, "İptal etiketi")?.counts.cancelled, 1);
    assert.equal(find(all, "İptal etiketi")?.groupId, null);
    const blanks = find(all, "Yalnız boş");
    assert.ok(blanks);
    assert.equal(blanks.counts.valid, 4);
    assert.equal(blanks.counts.blank, 4);
    assert.equal(readPerformance(topicMetrics({ ...blanks.counts, exams: blanks.examIds.length })), "blank");
    const empty = buildTopicView(all, { subjectId: "tyt_math", query: "", sort: "name" }).sections.flatMap(section => section.subjects).flatMap(subject => subject.groups).find(group => group.name === "Temel kavramlar");
    assert.equal(empty?.reading, "empty");
    assert.equal(all.topics.reduce((sum, item) => sum + item.counts.valid + item.counts.cancelled, 0), 6 + 4 + 1);
  } finally { await db.close(); }
});
