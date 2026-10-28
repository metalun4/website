// Production Next.js actions against an isolated PostgreSQL-backed Supabase API
// adapter. Never uses the configured remote project or real credentials.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-turbopack/client.browser");
const db = new PGlite();
await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
await db.exec(await readFile("supabase/schema.sql", "utf8"));
const adminId = randomUUID(), key = "isolated-server-credential-for-tests";
let limited = false;
let failDetail = false;
let detailWrites = 0;
const reads = new Map();
const api = createServer(async (req,res) => {
  res.setHeader("Content-Type","application/json");
  try {
    assert.equal(req.headers.apikey,key);
    const url = new URL(req.url,"http://localhost");
    let raw="";for await(const c of req) raw+=c;
    const body=raw?JSON.parse(raw):null;
    if(url.pathname==="/auth/v1/token") {
      if(body.email!=="admin@example.test"||body.password!=="test-password")return res.writeHead(400).end("{}");
      return res.end(JSON.stringify({user:{id:adminId}}));
    }
    const name=url.pathname.split("/").at(-1);
    if(req.method==="GET") reads.set(name,(reads.get(name)??0)+1);
    else if(["exams","exam_questions","exam_subject_results","exam_rankings","subjects","topics"].includes(name)) detailWrites++;
    if(name==="consume_login_attempt")return res.end(JSON.stringify(!limited));
    if(["preview_tyt_import","import_tyt_exam"].includes(name)) {
      const args=name==="import_tyt_exam"?[JSON.stringify(body.payload),body.admin_session_hash]:[JSON.stringify(body.payload)];
      return res.end(JSON.stringify((await db.query(`select public.${name}($1::jsonb${args.length===2?",$2":""}) result`,args)).rows[0].result));
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
        if(failDetail) return res.writeHead(503).end("{}");
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
const reservation=createServer();reservation.listen(0,"127.0.0.1");await once(reservation,"listening");const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const origin=`http://localhost:${port}`;
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{env:{...process.env,VERCEL:"",SUPABASE_URL:`http://127.0.0.1:${api.address().port}`,SUPABASE_SERVICE_ROLE_KEY:key,ADMIN_USER_ID:adminId,SESSION_SECRET:"isolated-integration-test-secret-at-least-32-chars"},stdio:["ignore","pipe","pipe"],windowsHide:true});
let logs="";child.stdout.on("data",c=>{logs+=c});child.stderr.on("data",c=>{logs+=c});
const get=(path,cookie="")=>fetch(origin+path,{headers:{cookie},redirect:"manual"});
const post=(path,data,cookie="")=>fetch(origin+path,{method:"POST",body:data,headers:{cookie,Origin:origin},redirect:"manual"});
const decode=s=>s.replaceAll("&quot;",'"').replaceAll("&amp;","&").replaceAll("&#x27;","'").replaceAll("&lt;","<").replaceAll("&gt;",">");
// Loading boundaries can flush the shell before an auth redirect. Next.js then
// sends a refresh meta tag instead of a Location header; verify both forms.
async function redirectOf(response) {
  const location=response.headers.get("location");if(location)return location;
  const html=await response.text();
  assert.doesNotMatch(html,/data-question=|data-result=/,"Unauthenticated responses must not contain report data");
  const meta=[...html.matchAll(/<meta\b[^>]*>/g)].find(m=>/http-equiv="refresh"/i.test(m[0]))?.[0];
  return meta ? decode(meta.match(/content="[^";]*;url=([^\"]+)"/)?.[1]??"") : null;
}
function form(html,marker){
  const match=[...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].find(m=>m[1].includes(marker));assert.ok(match,`Form containing ${marker}`);
  const data=new FormData();for(const input of match[1].matchAll(/<input\b[^>]*>/g)){
    const name=input[0].match(/name="([^"]*)"/)?.[1],value=input[0].match(/value="([^"]*)"/)?.[1];
    if(name&&input[0].includes('type="hidden"'))data.append(decode(name),decode(value??""));
  }return data;
}
const cookieOf=r=>r.headers.getSetCookie().find(v=>v.startsWith("yks_session=")&&!v.startsWith("yks_session=;"))?.split(";")[0];
const manifest=JSON.parse(await readFile(".next/server/server-reference-manifest.json","utf8"));
const actionId=Object.entries(manifest.node).find(([,v])=>v.exportedName==="importPdf")?.[0];assert.ok(actionId);
async function upload(file,cookie,mode="preview",receipt="",requestOrigin=origin){
  const bytes=await readFile(join(process.env.YKS_PDF_FIXTURE_DIR??join(homedir(),"Documents","ykspdf"),file));
  const data=new FormData();data.set("pdf",new File([bytes],file,{type:"application/pdf"}));data.set("mode",mode);data.set("receipt",receipt);
  return fetch(origin+"/yks27/admin",{method:"POST",headers:{cookie,Origin:requestOrigin,"Next-Action":actionId},body:await encodeReply([data]),redirect:"manual"});
}
function actionResult(text){
  for(const line of text.split("\n")){
    const i=line.indexOf(":");if(i<0)continue;
    try{const v=JSON.parse(line.slice(i+1));if(v?.preview||v?.success||v?.error)return v;if(v?.a&&typeof v.a==="object")return v.a;}catch{/* Other Flight chunks are module references. */}
  }throw new Error("No action result in production response");
}
const examCount=async()=>Number((await db.query("select count(*) n from public.exams")).rows[0].n);
try{
  let started=false;for(let i=0;i<100;i++){try{if((await get("/yks27/login")).status===200){started=true;break}}catch{/* starting */}await new Promise(r=>setTimeout(r,100));}assert.ok(started);
  const loginTarget = path => path === "/yks27" || path === "/yks27/tyt/invalid" ? "/yks27/login" : `/yks27/login?returnTo=${encodeURIComponent(path)}`;
  for(const path of ["/yks27","/yks27/ayt","/yks27/tyt","/yks27/tyt/dashboard","/yks27/admin","/yks27/tyt/invalid",`/yks27/tyt/${randomUUID()}`])assert.equal(await redirectOf(await get(path)),loginTarget(path));
  const loginHtml=await(await get("/yks27/login")).text();
  const credentials=form(loginHtml,'name="mode"');credentials.set("mode","admin");credentials.set("email","admin@example.test");credentials.set("password","wrong");
  assert.equal(cookieOf(await post("/yks27/login",credentials)),undefined);credentials.set("password","test-password");
  const signedIn=await post("/yks27/login",credentials),admin=cookieOf(signedIn);assert.ok(admin);assert.match(signedIn.headers.get("set-cookie"),/HttpOnly/i);assert.match(signedIn.headers.get("set-cookie"),/Secure/i);
  let html=await(await get("/yks27/admin",admin)).text();assert.match(html,/PDF’den deneme ekle/);assert.doesNotMatch(html,/name="turkce.correct"|name="pdf_url"/);
  const pinData=form(html,'name="label"');pinData.set("label","Test viewer");pinData.set("days","30");
  const pinHtml=await(await post("/yks27/admin",pinData,admin)).text(),pin=pinHtml.match(/<output[^>]*>(\d{10})<\/output>/)?.[1];assert.ok(pin);
  const viewerData=form(loginHtml,'name="mode"');viewerData.set("mode","viewer");viewerData.set("pin",pin);const viewer=cookieOf(await post("/yks27/login",viewerData));assert.ok(viewer);
  assert.equal(await redirectOf(await get("/yks27/admin",viewer)),"/yks27/tyt");
  for(const cookie of ["",viewer]){const r=await upload("qksssu3nm_.pdf",cookie);assert.ok([200,303].includes(r.status));assert.ok(r.headers.get("x-action-redirect")?.startsWith(cookie ? "/yks27/tyt;" : `${loginTarget("/yks27/admin")};`));assert.equal(await examCount(),0);}
  const preview=actionResult(await(await upload("qksssu3nm_.pdf",admin)).text()).preview;assert.equal(preview.exam.total_net,67.25);assert.equal(preview.questionCount,120);assert.ok(preview.receipt);assert.equal(await examCount(),0);assert.equal(Number((await db.query("select count(*) n from public.topics")).rows[0].n),0,"Preview creates no topics");
  const forged=actionResult(await(await upload("u6krt_69xh.pdf",admin,"confirm",preview.receipt)).text());assert.match(forged.error,/Önizleme/);assert.equal(await examCount(),0);
  const confirmed=actionResult(await(await upload("qksssu3nm_.pdf",admin,"confirm",preview.receipt)).text());assert.match(confirmed.success,/120 soru/);assert.ok(confirmed.reviewTopics.length);assert.equal(await examCount(),1);
  assert.match(actionResult(await(await upload("qksssu3nm_.pdf",admin,"confirm",preview.receipt)).text()).success,/zaten kayıtlı/);assert.equal(await examCount(),1);
  const cancelledPreview=actionResult(await(await upload("5ade3e51cd986a20854fff3770ec091034061db5.pdf",admin)).text()).preview;
  assert.equal(cancelledPreview.exam.total_net,62.75);assert.equal(cancelledPreview.warnings.filter(w=>w.includes("İPTAL")).length,2);assert.equal(await examCount(),1);
  assert.equal((await upload("qksssu3nm_.pdf",admin,"confirm",preview.receipt,"https://untrusted.example")).status,500);assert.equal(await examCount(),1);
  for(const cookie of [admin,viewer]){const listing=await(await get("/yks27/tyt",cookie)).text();assert.match(listing,/HIZ VE RENK/);assert.match(listing,/67,25/);assert.match(listing,/66,24/);assert.doesNotMatch(listing,/PDF’yi görüntüle/);assert.match(await(await get("/yks27/tyt/dashboard",cookie)).text(),/67,25/);}
  reads.clear();await(await get("/yks27/tyt",viewer)).text();
  assert.equal(reads.get("app_sessions"),1,"Session lookup is deduplicated within a server render");
  assert.equal(reads.get("viewer_pins"),1,"PIN lookup is deduplicated within a server render");
  const row=(await db.query("select id from public.exams")).rows[0];html=await(await get("/yks27/admin",admin)).text();
  const detailPath=`/yks27/tyt/${row.id}`;
  const goldens=JSON.parse(await readFile("tests/fixtures/tyt/goldens.json","utf8"));
  const expected=goldens.find(g=>g.file==="qksssu3nm_.pdf");assert.ok(expected);
  const dashboard=await(await get("/yks27/tyt/dashboard",viewer)).text();
  assert.match(dashboard,/YKS26 TYT/);assert.match(dashboard,/Puan farkı/);
  assert.ok(dashboard.includes(new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:"exceptZero"}).format(expected.exam.score-310.78679)),"Dashboard compares the stored exam score with TYT, excluding placement points");
  const writesBefore=detailWrites;
  for(const cookie of [admin,viewer]) {
    reads.clear();
    const response=await get(detailPath,cookie);assert.equal(response.status,200);
    const report=await response.text();
    assert.equal(reads.get("exams"),1,"Only one selected-exam query");
    assert.equal(reads.get("app_sessions"),1);
    assert.match(report,/noindex/);assert.match(report,/Ders sonuçları/);assert.match(report,/Konu analizi/);
    assert.ok(report.indexOf('id="ders-analizi"') < report.indexOf('id="siralamalar"'));
    assert.ok(report.indexOf('id="siralamalar"') < report.indexOf('id="konu-analizi"'));
    assert.doesNotMatch(report,/<details[^>]*id="siralamalar"|review-heading/);
    const questionKeys=[...report.matchAll(/data-question="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(questionKeys.length,120);assert.equal(new Set(questionKeys).size,120);
    const resultKeys=[...report.matchAll(/data-result="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(resultKeys.length,13);assert.equal(new Set(resultKeys).size,13);
    const format=(value,digits=2)=>value===null?"Veri yok":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
    for(const result of expected.subjects) {
      const rendered=report.match(new RegExp(`<tr[^>]*data-result="${result.subject_id}-${result.result_scope}"[^>]*>([\\s\\S]*?)</tr>`))?.[1];
      assert.ok(rendered);
      assert.deepEqual([...rendered.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(m=>m[1]),[result.question_count,result.correct_count,result.wrong_count,result.blank_count,result.net,result.average_net].map((value,i)=>format(value,i<4?0:2)));
    }
    for(const [label,field,digits] of [["Puan","score",2],["Toplam net","total_net",2],["Ortalama net","average_net",2],["Soru","total_questions",0],["Doğru","total_correct",0],["Yanlış","total_wrong",0],["Boş","total_blank",0]]) {
      const metric=report.match(new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>(.*?)</dd>`))?.[1];
      assert.equal(metric,format(expected.exam[field],digits));
    }
    for(const ranking of expected.rankings) {
      const label={general:"Genel",institution:"Kurum",branch:"Şube",class:"Sınıf"}[ranking.scope];
      const rendered=report.match(new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>([\\s\\S]*?)</dd>`))?.[1];
      assert.ok(rendered?.includes(format(ranking.rank,0)));assert.ok(rendered?.includes(format(ranking.participant_count,0)));
    }
    for(const q of expected.questions) {
      const rendered=report.match(new RegExp(`<tr[^>]*data-question="${q.subject_id}-${q.question_number}"[^>]*>([\\s\\S]*?)</tr>`))?.[1];
      assert.ok(rendered);assert.ok(decode(rendered).includes(q.topic_label));
    }
    for(const label of ["Genel","Kurum","Şube","Sınıf"])assert.ok(report.includes(label));
    assert.match(await(await get("/yks27/tyt",cookie)).text(),new RegExp(`href="${detailPath}"`));
    for(const id of ["invalid",randomUUID()]) {
      const missing=await get(`/yks27/tyt/${id}`,cookie);assert.ok([200,404].includes(missing.status));const notFoundHtml=await missing.text();assert.match(notFoundHtml,/TYT denemesi bulunamadı/);assert.match(notFoundHtml,/noindex/);assert.doesNotMatch(notFoundHtml,/data-question=/);
    }
  }
  assert.equal(detailWrites,writesBefore,"Detail viewing never writes exam data");
  const aytId=randomUUID();
  await db.query("insert into public.exams(id,exam_type,name,exam_date,total_questions,total_correct,total_wrong,total_blank,total_net) values($1,'AYT','AYT sentinel','2026-10-01',1,1,0,0,1)",[aytId]);
  const aytReport=await get(`/yks27/tyt/${aytId}`,viewer);assert.ok([200,404].includes(aytReport.status));assert.match(await aytReport.text(),/TYT denemesi bulunamadı/);
  await db.query("delete from public.exams where id=$1",[aytId]);
  // A streamed shell may already have status 200; the segment's Client Component
  // boundary renders recovery UI after hydration. No report data may be emitted.
  failDetail=true;const failed=await get(detailPath,viewer);assert.ok([200,500].includes(failed.status));const failedHtml=await failed.text();assert.doesNotMatch(failedHtml,/data-question=/);assert.match(failedHtml,/digest/);failDetail=false;
  const cancelledFile="5ade3e51cd986a20854fff3770ec091034061db5.pdf";
  assert.match(actionResult(await(await upload(cancelledFile,admin,"confirm",cancelledPreview.receipt)).text()).success,/120 soru/);
  const cancelledRow=(await db.query("select id from public.exams where id<>$1",[row.id])).rows[0];
  const cancelledHtml=await(await get(`/yks27/tyt/${cancelledRow.id}`,viewer)).text();
  assert.equal([...cancelledHtml.matchAll(/data-question="/g)].length,120);
  assert.equal([...cancelledHtml.matchAll(/İptal · Doğru sayıldı<\/td>/g)].length,2);
  assert.match(cancelledHtml,/62,75/);
  if(process.env.YKS_UI_PREVIEW) {
    const linkedPreview=actionResult(await(await upload("4xsy3iur3t.pdf",admin)).text()).preview;
    assert.ok(linkedPreview);assert.equal(linkedPreview.linkCount,120);
    assert.match(actionResult(await(await upload("4xsy3iur3t.pdf",admin,"confirm",linkedPreview.receipt)).text()).success,/120 soru/);
    const linkedRow=(await db.query("select id from public.exams where exam_date=$1",[linkedPreview.exam.exam_date])).rows[0];assert.ok(linkedRow);
    console.log("UI_PREVIEW_READY " + JSON.stringify({ origin, detailPath, cancelledPath: `/yks27/tyt/${cancelledRow.id}`, linkedPath: `/yks27/tyt/${linkedRow.id}` }));
    console.log("Isolated UI preview: admin@example.test / test-password. Send Enter to finish the remaining access checks and clean up.");
    process.stdin.resume();await once(process.stdin,"data");process.stdin.pause();
    await db.query("delete from public.exams where id=$1",[linkedRow.id]);
  }
  if(process.env.YKS_PLAYWRIGHT_MODULE) {
    const { testDetailBrowser }=await import("./test-detail-browser.mjs");
    await testDetailBrowser({origin,cookie:viewer,detailPath,cancelledPath:`/yks27/tyt/${cancelledRow.id}`,expected,setFailure:value=>{failDetail=value;}});
  }
  await db.query("delete from public.exams where id=$1",[cancelledRow.id]);
  const remove=form(html,`value="${row.id}"`);assert.equal((await post("/yks27/admin",remove,viewer)).headers.get("location"),"/yks27/tyt");assert.equal(await examCount(),1);assert.equal((await post("/yks27/admin",remove)).headers.get("location"),loginTarget("/yks27/admin"));
  await post("/yks27/admin",remove,admin);assert.equal(await examCount(),0);assert.equal(Number((await db.query("select count(*) n from public.exam_questions")).rows[0].n),0);
  await db.exec("update public.app_sessions set expires_at=now()-interval '1 hour' where role='viewer'");
  assert.equal(await redirectOf(await get(detailPath,viewer)),loginTarget(detailPath));
  assert.equal(await redirectOf(await get("/yks27/tyt",viewer)),loginTarget("/yks27/tyt"));
  await db.exec("update public.app_sessions set expires_at=now()+interval '1 hour' where role='viewer';update public.viewer_pins set expires_at=now()-interval '1 hour'");
  assert.equal(await redirectOf(await get("/yks27/tyt",viewer)),loginTarget("/yks27/tyt"));
  await db.exec("update public.viewer_pins set expires_at=now()+interval '1 hour'");
  const pinRow=(await db.query("select id from public.viewer_pins limit 1")).rows[0];await post("/yks27/admin",form(html,`value="${pinRow.id}"`),admin);assert.equal(await redirectOf(await get("/yks27/tyt",viewer)),loginTarget("/yks27/tyt"));
  assert.equal(await redirectOf(await get(detailPath,viewer)),loginTarget(detailPath));
  limited=true;assert.match(await(await post("/yks27/login",credentials)).text(),/Çok fazla/);limited=false;
  await post("/yks27/admin",form(html,"Çıkış yap"),admin);assert.equal(await redirectOf(await get("/yks27/admin",admin)),loginTarget("/yks27/admin"));
  async function inspect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await inspect(path);else if(path.endsWith(".js"))assert.ok(!(await readFile(path,"utf8")).includes(key),"Server credential in client bundle");}}await inspect(".next/static");
  console.log("PASS: TYT detail totals/13 results/4 rankings/120 questions/topics, admin/viewer access, invalid/unknown/AYT 404s, database errors, read-only retrieval, production PDF preview/confirmation, tamper/CSRF denial, duplicates, cancelled reports, listings/charts, topic warnings, cascading deletion, PIN revocation, rate limit, logout, client secret check.");
}catch(error){console.error(logs);throw error;}finally{child.kill();api.closeAllConnections();await new Promise(r=>api.close(r));await db.close();}
