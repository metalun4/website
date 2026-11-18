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
import { createIsolatedAdapter } from "./isolated-adapter.mjs";
const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-turbopack/client.browser");
const isolated = await createIsolatedAdapter();
const { db, key, reads, state } = isolated;
const reservation=createServer();reservation.listen(0,"127.0.0.1");await once(reservation,"listening");const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const origin=`http://localhost:${port}`;
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{env:{...process.env,...isolated.env},stdio:["ignore","pipe","pipe"],windowsHide:true});
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
const studyPath="/yks27/tyt/study";
async function studyAction(name,data,cookie="") {
  const id=Object.entries(manifest.node).find(([,v])=>v.exportedName===name)?.[0];assert.ok(id,`Built action ${name}`);
  return fetch(origin+studyPath,{method:"POST",headers:{cookie,Origin:origin,"Next-Action":id},body:await encodeReply([{},data]),redirect:"manual"});
}
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
  for(const path of ["/yks27","/yks27/ayt","/yks27/tyt","/yks27/tyt/dashboard",studyPath,"/yks27/admin","/yks27/tyt/invalid",`/yks27/tyt/${randomUUID()}`])assert.equal(await redirectOf(await get(path)),loginTarget(path));
  const loginHtml=await(await get("/yks27/login")).text();
  const credentials=form(loginHtml,'name="mode"');credentials.set("mode","admin");credentials.set("email","admin@example.test");credentials.set("password","wrong");
  assert.equal(cookieOf(await post("/yks27/login",credentials)),undefined);credentials.set("password","test-password");
  const signedIn=await post("/yks27/login",credentials),admin=cookieOf(signedIn);assert.ok(admin);assert.match(signedIn.headers.get("set-cookie"),/HttpOnly/i);assert.match(signedIn.headers.get("set-cookie"),/Secure/i);
  let html=await(await get("/yks27/admin",admin)).text();assert.match(html,/PDF’den deneme ekle/);assert.doesNotMatch(html,/name="turkce.correct"|name="pdf_url"/);
  const pinData=form(html,'name="label"');pinData.set("label","Test viewer");pinData.set("days","30");
  const pinHtml=await(await post("/yks27/admin",pinData,admin)).text(),pin=pinHtml.match(/<output[^>]*>(\d{10})<\/output>/)?.[1];assert.ok(pin);
  const viewerData=form(loginHtml,'name="mode"');viewerData.set("mode","viewer");viewerData.set("pin",pin);const viewer=cookieOf(await post("/yks27/login",viewerData));assert.ok(viewer);
  assert.equal(await redirectOf(await get("/yks27/admin",viewer)),"/yks27/tyt");
  // Actual built Server Actions, including forged requests from clients that
  // never received mutation controls. All records live only in this PGlite DB.
  const studyCatalog=(await db.query("select public.topic_study_catalog() result")).rows[0].result;
  const mathGroups=studyCatalog.groups.filter(group=>group.subject_id==="tyt_math");assert.ok(mathGroups.length>=21);
  const firstGroup=mathGroups[0].id;
  const studyData=(ids=[firstGroup],date="2020-11-10")=>{
    const data=new FormData();data.set("groupId",ids[0]);data.set("subjectId","tyt_math");data.set("completedOn",date);
    for(const id of ids)data.append("groupIds",id);return data;
  };
  const studyRows=async()=>(await db.query("select group_id,completed_on::text from public.topic_group_study order by group_id")).rows;
  const adminStudy=await(await get(studyPath,admin)).text();
  assert.match(adminStudy,/İşlenen konular/);assert.match(adminStudy,/Bitirdiğim tarih/);
  const todayParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const todayPart=type=>todayParts.find(part=>part.type===type).value;
  const studyToday=`${todayPart("year")}-${todayPart("month")}-${todayPart("day")}`;
  assert.ok(adminStudy.includes(`max="${studyToday}"`),"Completion inputs use today in Istanbul");
  for(const group of studyCatalog.groups)assert.ok(adminStudy.includes(`id="grup-${group.id}"`),"All groups, even before any exam, are listed");
  const viewerStudy=await(await get(studyPath,viewer)).text();
  assert.match(viewerStudy,/Salt okunur/);assert.doesNotMatch(viewerStudy.match(/<main\b[\s\S]*?<\/main>/)?.[0]??"",/<form\b|type="checkbox"|type="date"|name="groupIds"/);
  for(const cookie of ["",viewer])for(const name of ["saveStudyGroup","saveStudyGroups","clearStudyGroup"]){
    const denied=await studyAction(name,studyData(),cookie);
    assert.ok([200,303].includes(denied.status));
    assert.ok(denied.headers.get("x-action-redirect")?.startsWith(cookie?"/yks27/tyt;":`${loginTarget("/yks27/admin")};`));
    assert.deepEqual(await studyRows(),[]);
  }
  const saved=actionResult(await(await studyAction("saveStudyGroup",studyData(),admin)).text());assert.equal(saved.saved,1);assert.ok(!saved.error);
  assert.equal((await studyRows())[0].completed_on,"2020-11-10");
  const batch=studyData(mathGroups.slice(0,21).map(group=>group.id),"2020-11-08");
  const batched=actionResult(await(await studyAction("saveStudyGroups",batch,admin)).text());assert.equal(batched.saved,20);assert.equal(batched.skipped,1);
  assert.equal((await studyRows()).find(group=>group.group_id===firstGroup).completed_on,"2020-11-10","Batch cannot overwrite existing dates");
  for(const data of [studyData(["invalid"]),studyData([randomUUID()]),studyData([firstGroup],"2026-02-30"),studyData([firstGroup],"2999-01-01"),studyData([firstGroup],"")]){
    const before=await studyRows();const failed=actionResult(await(await studyAction("saveStudyGroup",data,admin)).text());assert.ok(failed.error);assert.ok(!failed.success);assert.deepEqual(await studyRows(),before);
  }
  const badBatch=studyData([mathGroups[21]?.id??randomUUID(),randomUUID()]);
  const beforeBadBatch=await studyRows();assert.ok(actionResult(await(await studyAction("saveStudyGroups",badBatch,admin)).text()).error);assert.deepEqual(await studyRows(),beforeBadBatch,"Invalid batch writes nothing");
  const otherSubject=studyCatalog.groups.find(group=>group.subject_id!=="tyt_math");assert.ok(otherSubject);
  for(const invalidBatch of [new FormData(),studyData([otherSubject.id]),studyData([mathGroups[21].id],"2999-01-01")]){
    const before=await studyRows();assert.ok(actionResult(await(await studyAction("saveStudyGroups",invalidBatch,admin)).text()).error);assert.deepEqual(await studyRows(),before);
  }
  const changed=actionResult(await(await studyAction("saveStudyGroup",studyData([firstGroup],"2020-11-12"),admin)).text());assert.ok(changed.success);assert.equal((await studyRows()).find(group=>group.group_id===firstGroup).completed_on,"2020-11-12");
  const markedViewer=await(await get(studyPath,viewer)).text();assert.match(markedViewer,/İşlendi/);assert.match(markedViewer,/datetime="2020-11-12"/i);
  for(const name of ["saveStudyGroup","saveStudyGroups","clearStudyGroup"])for(const cookie of ["",viewer]){
    const before=await studyRows();const denied=await studyAction(name,studyData(),cookie);assert.ok(denied.headers.get("x-action-redirect"));assert.deepEqual(await studyRows(),before,"Unauthorized action cannot change marked groups");
  }
  assert.ok(actionResult(await(await studyAction("saveStudyGroup",studyData([firstGroup],studyToday),admin)).text()).success,"Today in Istanbul is accepted by the action");
  const cleared=actionResult(await(await studyAction("clearStudyGroup",studyData(),admin)).text());assert.ok(cleared.success);assert.ok(!(await studyRows()).some(group=>group.group_id===firstGroup));
  assert.ok(actionResult(await(await studyAction("clearStudyGroup",studyData(),admin)).text()).success,"Clear is idempotent");
  // Simulate an RPC persistence failure after valid server-side validation.
  await db.exec("create function public.reject_study_test_write() returns trigger language plpgsql as $$ begin raise exception 'isolated write failure'; end; $$; create trigger reject_study_test before insert on public.topic_group_study for each row execute function public.reject_study_test_write();");
  try {
    const before=await studyRows();const failed=actionResult(await(await studyAction("saveStudyGroup",studyData(),admin)).text());assert.ok(failed.error);assert.ok(!failed.success);assert.deepEqual(await studyRows(),before);
  }finally{await db.exec("drop trigger reject_study_test on public.topic_group_study; drop function public.reject_study_test_write(); delete from public.topic_group_study;");}
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
  const writesBefore=state.detailWrites;
  for(const cookie of [admin,viewer]) {
    reads.clear();
    const response=await get(detailPath,cookie);assert.equal(response.status,200);
    const report=await response.text();
    assert.equal(reads.get("exams"),1,"Only one selected-exam query");
    assert.equal(reads.get("app_sessions"),1);
    assert.match(report,/noindex/);assert.match(report,/Ders sonuçları/);assert.match(report,/Konu analizi/);
    assert.ok(report.includes('href="#islenen-konularda-kacirilanlar"'));
    assert.ok(report.includes('id="islenen-konularda-kacirilanlar"'));
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
  assert.equal(state.detailWrites,writesBefore,"Detail viewing never writes exam data");
  const aytId=randomUUID();
  await db.query("insert into public.exams(id,exam_type,name,exam_date,total_questions,total_correct,total_wrong,total_blank,total_net) values($1,'AYT','AYT sentinel','2026-10-01',1,1,0,0,1)",[aytId]);
  const aytReport=await get(`/yks27/tyt/${aytId}`,viewer);assert.ok([200,404].includes(aytReport.status));assert.match(await aytReport.text(),/TYT denemesi bulunamadı/);
  await db.query("delete from public.exams where id=$1",[aytId]);
  // A streamed shell may already have status 200; the segment's Client Component
  // boundary renders recovery UI after hydration. No report data may be emitted.
  state.failDetail=true;const failed=await get(detailPath,viewer);assert.ok([200,500].includes(failed.status));const failedHtml=await failed.text();assert.doesNotMatch(failedHtml,/data-question=/);assert.match(failedHtml,/digest/);state.failDetail=false;
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
    await testDetailBrowser({origin,cookie:viewer,detailPath,cancelledPath:`/yks27/tyt/${cancelledRow.id}`,expected,setFailure:value=>{state.failDetail=value;}});
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
  state.limited=true;assert.match(await(await post("/yks27/login",credentials)).text(),/Çok fazla/);state.limited=false;
  await post("/yks27/admin",form(html,"Çıkış yap"),admin);assert.equal(await redirectOf(await get("/yks27/admin",admin)),loginTarget("/yks27/admin"));
  async function inspect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await inspect(path);else if(path.endsWith(".js"))assert.ok(!(await readFile(path,"utf8")).includes(key),"Server credential in client bundle");}}await inspect(".next/static");
  console.log("PASS: study catalog/admin save/edit/batch skip/clear/validation/persistence failure/viewer and unauthenticated write denials, TYT detail totals/13 results/4 rankings/120 questions/topics, admin/viewer access, invalid/unknown/AYT 404s, database errors, read-only retrieval, production PDF preview/confirmation, tamper/CSRF denial, duplicates, cancelled reports, listings/charts, topic warnings, cascading deletion, PIN revocation, rate limit, logout, client secret check.");
}catch(error){console.error(logs);throw error;}finally{child.kill();await isolated.close();}
