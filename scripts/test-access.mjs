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
      if(name==="exams") {
        assert.equal(url.searchParams.get("select"),"id,name,exam_date,average_net,exam_subject_results(subject_id,result_scope,correct_count,wrong_count,average_net),exam_rankings(scope,rank,participant_count)");
        assert.equal(url.searchParams.get("exam_rankings.scope"),"eq.general");
        rows=await db.query(`select jsonb_build_object('id',t.id,'name',t.name,'exam_date',t.exam_date,'average_net',t.average_net,
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
  for(const path of ["/yks27","/yks27/ayt","/yks27/tyt","/yks27/tyt/dashboard","/yks27/admin"])assert.equal((await get(path)).headers.get("location"),"/yks27/login");
  const loginHtml=await(await get("/yks27/login")).text();
  const credentials=form(loginHtml,'name="mode"');credentials.set("mode","admin");credentials.set("email","admin@example.test");credentials.set("password","wrong");
  assert.equal(cookieOf(await post("/yks27/login",credentials)),undefined);credentials.set("password","test-password");
  const signedIn=await post("/yks27/login",credentials),admin=cookieOf(signedIn);assert.ok(admin);assert.match(signedIn.headers.get("set-cookie"),/HttpOnly/i);assert.match(signedIn.headers.get("set-cookie"),/Secure/i);
  let html=await(await get("/yks27/admin",admin)).text();assert.match(html,/PDF’den deneme ekle/);assert.doesNotMatch(html,/name="turkce.correct"|name="pdf_url"/);
  const pinData=form(html,'name="label"');pinData.set("label","Test viewer");pinData.set("days","30");
  const pinHtml=await(await post("/yks27/admin",pinData,admin)).text(),pin=pinHtml.match(/<output[^>]*>(\d{10})<\/output>/)?.[1];assert.ok(pin);
  const viewerData=form(loginHtml,'name="mode"');viewerData.set("mode","viewer");viewerData.set("pin",pin);const viewer=cookieOf(await post("/yks27/login",viewerData));assert.ok(viewer);
  assert.equal((await get("/yks27/admin",viewer)).headers.get("location"),"/yks27/tyt");
  for(const cookie of ["",viewer]){const r=await upload("qksssu3nm_.pdf",cookie);assert.ok([200,303].includes(r.status));assert.ok(r.headers.get("x-action-redirect")?.startsWith(cookie ? "/yks27/tyt;" : "/yks27/login;"));assert.equal(await examCount(),0);}
  const preview=actionResult(await(await upload("qksssu3nm_.pdf",admin)).text()).preview;assert.equal(preview.exam.total_net,67.25);assert.equal(preview.questionCount,120);assert.ok(preview.receipt);assert.equal(await examCount(),0);assert.equal(Number((await db.query("select count(*) n from public.topics")).rows[0].n),0,"Preview creates no topics");
  const forged=actionResult(await(await upload("u6krt_69xh.pdf",admin,"confirm",preview.receipt)).text());assert.match(forged.error,/Önizleme/);assert.equal(await examCount(),0);
  const confirmed=actionResult(await(await upload("qksssu3nm_.pdf",admin,"confirm",preview.receipt)).text());assert.match(confirmed.success,/120 soru/);assert.ok(confirmed.reviewTopics.length);assert.equal(await examCount(),1);
  assert.match(actionResult(await(await upload("qksssu3nm_.pdf",admin,"confirm",preview.receipt)).text()).success,/zaten kayıtlı/);assert.equal(await examCount(),1);
  assert.match(actionResult(await(await upload("5ade3e51cd986a20854fff3770ec091034061db5.pdf",admin)).text()).error,/iptal/);
  assert.equal((await upload("qksssu3nm_.pdf",admin,"confirm",preview.receipt,"https://untrusted.example")).status,500);assert.equal(await examCount(),1);
  for(const cookie of [admin,viewer]){const listing=await(await get("/yks27/tyt",cookie)).text();assert.match(listing,/HIZ VE RENK/);assert.match(listing,/67,25/);assert.match(listing,/66,24/);assert.doesNotMatch(listing,/PDF’yi görüntüle/);assert.match(await(await get("/yks27/tyt/dashboard",cookie)).text(),/67,25/);}
  reads.clear();await(await get("/yks27/tyt",viewer)).text();
  assert.equal(reads.get("app_sessions"),1,"Session lookup is deduplicated within a server render");
  assert.equal(reads.get("viewer_pins"),1,"PIN lookup is deduplicated within a server render");
  const row=(await db.query("select id from public.exams")).rows[0];html=await(await get("/yks27/admin",admin)).text();
  const remove=form(html,`value="${row.id}"`);assert.equal((await post("/yks27/admin",remove,viewer)).headers.get("location"),"/yks27/tyt");assert.equal(await examCount(),1);assert.equal((await post("/yks27/admin",remove)).headers.get("location"),"/yks27/login");
  await post("/yks27/admin",remove,admin);assert.equal(await examCount(),0);assert.equal(Number((await db.query("select count(*) n from public.exam_questions")).rows[0].n),0);
  await db.exec("update public.app_sessions set expires_at=now()-interval '1 hour' where role='viewer'");
  assert.equal((await get("/yks27/tyt",viewer)).headers.get("location"),"/yks27/login");
  await db.exec("update public.app_sessions set expires_at=now()+interval '1 hour' where role='viewer';update public.viewer_pins set expires_at=now()-interval '1 hour'");
  assert.equal((await get("/yks27/tyt",viewer)).headers.get("location"),"/yks27/login");
  await db.exec("update public.viewer_pins set expires_at=now()+interval '1 hour'");
  const pinRow=(await db.query("select id from public.viewer_pins limit 1")).rows[0];await post("/yks27/admin",form(html,`value="${pinRow.id}"`),admin);assert.equal((await get("/yks27/tyt",viewer)).headers.get("location"),"/yks27/login");
  limited=true;assert.match(await(await post("/yks27/login",credentials)).text(),/Çok fazla/);limited=false;
  await post("/yks27/admin",form(html,"Çıkış yap"),admin);assert.equal((await get("/yks27/admin",admin)).headers.get("location"),"/yks27/login");
  async function inspect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await inspect(path);else if(path.endsWith(".js"))assert.ok(!(await readFile(path,"utf8")).includes(key),"Server credential in client bundle");}}await inspect(".next/static");
  console.log("PASS: production PDF preview/confirmation, authorization, tamper/CSRF denial, duplicates, cancelled reports, listings/charts, topic warnings, cascading deletion, PIN revocation, rate limit, logout, client secret check.");
}catch(error){console.error(logs);throw error;}finally{child.kill();api.closeAllConnections();await new Promise(r=>api.close(r));await db.close();}
