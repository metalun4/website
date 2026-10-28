import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { fixtureReport, goldens } from "./fixtures";

test("PostgreSQL schema, six real imports, exact persistence, permissions, duplicates, topic reuse and atomic rollback", async () => {
  const db = new PGlite();
  const call = async (r: unknown, session = "test-admin") => (await db.query<{ result: { status:string;exam_id:string;review_topics: {id:string}[] } }>("select public.import_tyt_exam($1::jsonb,$2) result", [JSON.stringify(r),session])).rows[0].result;
  const count = async (table: string) => Number((await db.query<{n:number}>(`select count(*) n from public.${table}`)).rows[0].n);
  try {
    await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
    await db.exec(await readFile("supabase/schema.sql", "utf8"));
    await db.exec("insert into public.app_sessions values ('test-admin','admin',null,now()+interval '1 hour');");
    const first = await fixtureReport();
    await assert.rejects(call(first, "not-admin"), /ADMIN_REQUIRED/);
    await db.exec("set role service_role");
    for (const g of goldens) {
      const parsed = await fixtureReport(g.file);
      const result = await call(parsed);
      assert.equal(result.status, "imported");
      assert.ok(result.review_topics.length > 0);
      const stored = (await db.query<{data:unknown}>("select to_jsonb(e)-'id'-'created_at' as data from public.exams e where id=$1", [result.exam_id])).rows[0].data;
      assert.deepEqual(stored, g.exam);
      const rows = await db.query<{data:unknown}>("select to_jsonb(r)-'exam_id' as data from public.exam_subject_results r where exam_id=$1 order by subject_id,result_scope", [result.exam_id]);
      assert.deepEqual(rows.rows.map(r=>r.data), [...g.subjects].sort((a,b)=>(a.subject_id+":"+a.result_scope).localeCompare(b.subject_id+":"+b.result_scope)));
    }
    assert.equal(await count("exams"), 6); assert.equal(await count("exam_questions"), 720); assert.equal(await count("exam_subject_results"), 78); assert.equal(await count("exam_rankings"), 24); assert.equal(await count("subjects"), 12);
    const cancelled = await fixtureReport("5ade3e51cd986a20854fff3770ec091034061db5.pdf");
    const cancelledResult = await call(cancelled);
    assert.equal(cancelledResult.status,"imported");
    const cancelledRows = await db.query<{question_number:number;correct_answer:string;selected_answer:null}>("select question_number,correct_answer,selected_answer from public.exam_questions where exam_id=$1 and correct_answer='İPTAL' order by question_number",[cancelledResult.exam_id]);
    assert.deepEqual(cancelledRows.rows,[{question_number:17,correct_answer:"İPTAL",selected_answer:null},{question_number:25,correct_answer:"İPTAL",selected_answer:null}]);
    assert.equal((await call(cancelled)).status,"duplicate");
    await db.query("delete from public.exams where id=$1",[cancelledResult.exam_id]);
    const topicsBefore = await count("topics");
    const repeated = await Promise.all([call(first),call(first)]);
    assert.ok(repeated.every(r => r.status === "duplicate"));
    assert.equal(await count("exams"), 6); assert.equal(await count("topics"), topicsBefore);
    const collision = structuredClone(first); collision.exam.score!++;
    assert.equal((await call(collision)).status, "collision");
    const separate = structuredClone(first); separate.exam.name = "Different same-day exam"; separate.questions[0].topic_label = "Distinct printed topic";
    const topicVersions = (await db.query("select id,xmin::text as version from public.topics order by id")).rows;
    assert.equal((await call(separate)).status, "imported", "Exam dates are not unique");
    const existingIds=topicVersions.map(t=>(t as {id:string}).id);
    assert.deepEqual((await db.query("select id,xmin::text as version from public.topics where id=any($1::uuid[]) order by id",[existingIds])).rows,topicVersions,"Reused topics must not receive no-op updates or new row versions");
    const bad = structuredClone(first); bad.exam.exam_date = "2026-11-01"; bad.questions[119].topic_label = "Rollback sentinel topic"; bad.rankings[3].participant_count = 0;
    const beforeFailure = await count("topics");
    await assert.rejects(call(bad));
    assert.equal(await count("topics"), beforeFailure);
    assert.equal((await db.query("select id from public.exams where exam_date='2026-11-01'")).rows.length, 0);
    const mismatch = structuredClone(first); mismatch.exam.exam_date = "2026-11-02"; mismatch.subjects[0].correct_count--; mismatch.subjects[0].blank_count++; mismatch.subjects[0].net--;
    await assert.rejects(call(mismatch), /SUBJECT_RESULT_MISMATCH/);
    const incomplete = structuredClone(first); incomplete.questions.pop();
    await assert.rejects(call(incomplete), /INCOMPLETE_REPORT/);
    const cross = await db.query<{exam_id:string;topic_id:string}>("select exam_id,topic_id from public.exam_questions where subject_id='tyt_turkish' limit 1");
    await assert.rejects(db.query("insert into public.exam_questions(exam_id,question_number,subject_id,topic_id,correct_answer) values($1,99,'tyt_math',$2,'A')",[cross.rows[0].exam_id,cross.rows[0].topic_id]), /foreign key/);
    const normalization = await db.query<{value:string}>("select public.normalize_topic_label($1) value",["  IŞIK\u00a0İLİŞKİSİ  "]);
    assert.equal(normalization.rows[0].value, "ışık ilişkisi");
    await assert.rejects(db.exec("update public.subjects set exam_type='AYT' where id='tyt_turkish'"), /SUBJECT_DEFINITION_IN_USE/);
    await assert.rejects(db.query("update public.exams set exam_type='AYT' where id=$1",[cross.rows[0].exam_id]), /SUBJECT_EXAM_TYPE/);
    await db.exec("insert into public.subjects values ('ayt_math','Matematik','AYT',null,null,20)");
    await db.exec("insert into public.topics(subject_id,name,normalized_name) values('ayt_math','Fonksiyonlar','fonksiyonlar')");
    await assert.rejects(db.exec("insert into public.subjects values('ayt_geometry','Geometri','AYT','tyt_math',null,21)"), /SUBJECT_EXAM_TYPE/);
    for (const role of ["anon","authenticated"]) {
      await db.exec(`reset role;set role ${role}`);
      await assert.rejects(db.query("select * from public.exams"), /permission denied/);
      await assert.rejects(call(first), /permission denied/);
    }
    await db.exec("reset role");
    const rls = await db.query<{relname:string;relrowsecurity:boolean}>("select relname,relrowsecurity from pg_class where oid in ('public.exams'::regclass,'public.subjects'::regclass,'public.topics'::regclass,'public.exam_questions'::regclass,'public.exam_subject_results'::regclass,'public.exam_rankings'::regclass)");
    assert.equal(rls.rows.length, 6); assert.ok(rls.rows.every(r=>r.relrowsecurity));
  } finally { await db.close(); }
});

test("authorized legacy reset migration preserves PINs and active sessions", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
    const schema = await readFile("supabase/schema.sql", "utf8");
    await db.exec(schema.slice(0,schema.indexOf("create table public.exams")) + "commit;");
    await db.exec("create table public.exams(id uuid primary key default gen_random_uuid(), date date not null,name text not null,rank integer,participants integer,pdf_url text,subjects jsonb not null,created_at timestamptz default now()); insert into public.exams(date,name,subjects) values('2026-10-01','Old summary','[]'); insert into public.viewer_pins(label,pin_hash,expires_at) values('Preserved viewer','pin-hash',now()+interval '1 day'); insert into public.app_sessions values('preserved-admin','admin',null,now()+interval '1 hour');");
    const migration = await readFile("supabase/migrations/20261028135230_tyt_pdf_import.sql","utf8");
    await db.exec(migration);
    const preserved = (await db.query<{result:{exam_id:string}}>("select public.import_tyt_exam($1::jsonb,'preserved-admin') result",[JSON.stringify(await fixtureReport())])).rows[0].result.exam_id;
    const cancellationMigration = await readFile("supabase/migrations/20261028154317_cancelled_questions.sql","utf8");
    await db.exec(cancellationMigration);
    assert.equal(Number((await db.query<{n:number}>("select count(*) n from public.exams")).rows[0].n),1);
    assert.equal(Number((await db.query<{n:number}>("select count(*) n from public.exam_questions where exam_id=$1",[preserved])).rows[0].n),120);
    assert.equal(Number((await db.query<{n:number}>("select count(*) n from public.subjects")).rows[0].n),12);
    assert.equal((await db.query<{label:string}>("select label from public.viewer_pins")).rows[0].label,"Preserved viewer");
    assert.equal((await db.query<{token_hash:string}>("select token_hash from public.app_sessions")).rows[0].token_hash,"preserved-admin");
    const result = await db.query<{result:{status:string}}>("select public.import_tyt_exam($1::jsonb,'preserved-admin') result",[JSON.stringify(await fixtureReport())]);
    assert.equal(result.rows[0].result.status,"duplicate");
    const core = (sql: string) => sql.slice(sql.indexOf("create table public.exams")).replaceAll("\r\n","\n");
    assert.equal(core(schema),core(migration)+"\n"+cancellationMigration.replaceAll("\r\n","\n"),"Fresh install and migration chain must have identical exam definitions");
  } finally { await db.close(); }
});
