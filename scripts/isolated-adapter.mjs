// Shared in-memory PostgreSQL-backed Supabase adapter. It accepts only local,
// whitelisted API paths; no connection to any configured Supabase project.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export async function createIsolatedAdapter() {
const db = new PGlite();
await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
await db.exec(await readFile("supabase/schema.sql", "utf8"));
const adminId = randomUUID(), key = "isolated-server-credential-for-tests";
const state = { limited: false, failDetail: false, detailWrites: 0, delayMs: 0 };
const reads = new Map();
const api = createServer(async (req,res) => {
  res.setHeader("Content-Type","application/json");
  try {
    assert.equal(req.headers.apikey,key);
    if (state.delayMs) await new Promise(resolve => setTimeout(resolve, state.delayMs));
    const url = new URL(req.url,"http://localhost");
    let raw="";for await(const c of req) raw+=c;
    const body=raw?JSON.parse(raw):null;
    if (url.pathname === "/_isolated/control" && state.control) {
      await state.control(body.command);
      return res.end(JSON.stringify({ok:true}));
    }
    if(url.pathname==="/auth/v1/token") {
      if(body.email!=="admin@example.test"||body.password!=="test-password")return res.writeHead(400).end("{}");
      return res.end(JSON.stringify({user:{id:adminId}}));
    }
    const name=url.pathname.split("/").at(-1);
    if(req.method==="GET") reads.set(name,(reads.get(name)??0)+1);
    else if(["exams","exam_questions","exam_subject_results","exam_rankings","subjects","topics"].includes(name)) state.detailWrites++;
    if(name==="consume_login_attempt")return res.end(JSON.stringify(!state.limited));
    if(["preview_tyt_import","import_tyt_exam"].includes(name)) {
      const args=name==="import_tyt_exam"?[JSON.stringify(body.payload),body.admin_session_hash]:[JSON.stringify(body.payload)];
      return res.end(JSON.stringify((await db.query(`select public.${name}($1::jsonb${args.length===2?",$2":""}) result`,args)).rows[0].result));
    }
    const rpcs = {
      tyt_topic_analysis: [["exam_limit", "integer"]],
      topic_exam_breakdown: [["target_topic", "uuid"], ["exam_limit", "integer"]],
      topic_admin_catalog: [],
      topic_study_catalog: [],
      set_topic_group_study: [["target_groups", "uuid[]"], ["completed_on", "date"], ["overwrite", "boolean"], ["admin_session_hash", "text"]],
      clear_topic_group_study: [["target_group", "uuid"], ["admin_session_hash", "text"]],
      tyt_study_analysis: [["target_exam", "uuid"], ["include_questions", "boolean"]],
      assign_topic_group: [["target_topic", "uuid"], ["target_group", "uuid"], ["admin_session_hash", "text"]],
      save_topic_alias: [["target_alias", "uuid"], ["target_subject", "text"], ["target_group", "uuid"], ["alias_text", "text"], ["admin_session_hash", "text"]],
      delete_topic_alias: [["target_alias", "uuid"], ["admin_session_hash", "text"]],
    };
    if (Object.hasOwn(rpcs, name)) {
      const spec = rpcs[name];
      const result = await db.query(`select public.${name}(${spec.map(([,type],i) => `$${i+1}::${type}`).join(",")}) result`, spec.map(([field]) => body[field] ?? null));
      return res.end(JSON.stringify(result.rows[0].result));
    }
    assert.ok(["exams","viewer_pins","app_sessions"].includes(name));
    const params=[],filters=[];
    for(const [column,filter]of url.searchParams) {
      if(["select","order","limit"].includes(column))continue;
      if(column==="exam_subject_results.subject_id") { assert.equal(filter,"in.(tyt_turkish,tyt_social,tyt_math,tyt_science)");continue; }
      if(column==="exam_subject_results.or") { assert.equal(filter,"(result_scope.eq.aggregate,subject_id.eq.tyt_turkish)");continue; }
      if(column==="exam_rankings.scope") { assert.equal(filter,"eq.general");continue; }
      assert.match(column,/^[a-z_]+$/);const op=filter.slice(0,3);assert.ok(["eq.","gt."].includes(op));
      params.push(filter.slice(3));filters.push(`t.${column}${op==="eq."?"=":">"}$${params.length}`);
    }
    const where=filters.length?` where ${filters.join(" and ")}`:"";
    let rows;
    if(req.method==="GET") {
      if(name==="exams" && url.searchParams.has("id") && req.method==="GET") {
        assert.equal(url.searchParams.get("exam_type"),"eq.TYT");
        assert.equal(url.searchParams.get("limit"),"1");
        assert.equal(url.searchParams.get("select"),"id,name,exam_date,institution_name,class_label,score,total_questions,total_correct,total_wrong,total_blank,total_net,average_net,exam_subject_results(subject_id,result_scope,question_count,correct_count,wrong_count,blank_count,net,average_net,subject:subjects(id,name,parent_id,display_order)),exam_rankings(scope,rank,participant_count),exam_questions(id,subject_id,question_number,correct_answer,selected_answer,solution_url,topic:topics!exam_questions_topic_id_fkey(name,needs_review))");
        if(state.failDetail) return res.writeHead(503).end("{}");
        rows=await db.query(`select (to_jsonb(t)-'source_pdf_path'-'created_at'-'report_generated_at'-'exam_type') || jsonb_build_object(
          'exam_subject_results',coalesce((select jsonb_agg((to_jsonb(r)-'exam_id') || jsonb_build_object('subject',jsonb_build_object('id',s.id,'name',s.name,'parent_id',s.parent_id,'display_order',s.display_order))) from public.exam_subject_results r join public.subjects s on s.id=r.subject_id where r.exam_id=t.id),'[]'::jsonb),
          'exam_rankings',coalesce((select jsonb_agg(to_jsonb(r)-'exam_id') from public.exam_rankings r where r.exam_id=t.id),'[]'::jsonb),
          'exam_questions',coalesce((select jsonb_agg((to_jsonb(q)-'exam_id'-'topic_id') || jsonb_build_object('topic',jsonb_build_object('name',topic.name,'needs_review',topic.needs_review))) from public.exam_questions q join public.topics topic on topic.id=q.topic_id where q.exam_id=t.id),'[]'::jsonb)
        ) as row from public.exams t${where} limit 1`,params);
      } else if(name==="exams") {
        assert.equal(url.searchParams.get("select"),"id,name,exam_date,score,average_net,exam_subject_results(subject_id,result_scope,correct_count,wrong_count,average_net),exam_rankings(scope,rank,participant_count)");
        assert.equal(url.searchParams.get("exam_rankings.scope"),"eq.general");
        rows=await db.query(`select jsonb_build_object('id',t.id,'name',t.name,'exam_date',t.exam_date,'score',t.score,'average_net',t.average_net,
          'exam_subject_results',coalesce((select jsonb_agg(jsonb_build_object('subject_id',r.subject_id,'result_scope',r.result_scope,'correct_count',r.correct_count,'wrong_count',r.wrong_count,'average_net',r.average_net)) from public.exam_subject_results r where r.exam_id=t.id and r.subject_id in ('tyt_turkish','tyt_social','tyt_math','tyt_science') and (r.result_scope='aggregate' or r.subject_id='tyt_turkish')),'[]'::jsonb),
          'exam_rankings',coalesce((select jsonb_agg(jsonb_build_object('scope',r.scope,'rank',r.rank,'participant_count',r.participant_count)) from public.exam_rankings r where r.exam_id=t.id and r.scope='general'),'[]'::jsonb)) as row from public.exams t${where} order by exam_date,id`,params);
      } else rows=await db.query(`select to_jsonb(t) as row from public.${name} t${where}`,params);
    }else if(req.method==="POST") {
      const cols=Object.keys(body);for(const c of cols)assert.match(c,/^[a-z_]+$/);
      rows=await db.query(`insert into public.${name}(${cols.join(",")}) select ${cols.map(c=>`r.${c}`).join(",")} from jsonb_populate_record(null::public.${name},$1::jsonb) r returning to_jsonb(${name}.*) as row`,[JSON.stringify(body)]);
    }else if(req.method==="PATCH") {
      const cols=Object.keys(body);for(const c of cols)assert.match(c,/^[a-z_]+$/);
      const sets=cols.map(c=>{params.push(body[c]);return `${c}=$${params.length}`});
      rows=await db.query(`update public.${name} t set ${sets.join(",")}${where} returning to_jsonb(t) as row`,params);
    }else{
      assert.equal(req.method,"DELETE");rows=await db.query(`delete from public.${name} t${where} returning to_jsonb(t) as row`,params);
    }
    res.end(JSON.stringify(rows.rows.map(r=>r.row)));
  }catch{res.writeHead(400).end(JSON.stringify({error:"isolated database rejected request"}));}
});
api.listen(0,"127.0.0.1");await once(api,"listening");
const env = { VERCEL: "", SUPABASE_URL: `http://127.0.0.1:${api.address().port}`, SUPABASE_SERVICE_ROLE_KEY: key, ADMIN_USER_ID: adminId, SESSION_SECRET: "isolated-integration-test-secret-at-least-32-chars", NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import ./scripts/without-dotenv.mjs`.trim() };
return { db, api, key, adminId, reads, state, env,
  async close() { api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); await db.close(); }
};
}
