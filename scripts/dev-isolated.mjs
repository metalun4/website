// npm run dev:isolated — http://127.0.0.1:3457, with an in-memory PGlite DB.
// Seeded only from repository goldens through import_tyt_exam. Set the printed
// yks_session cookie in your browser; all data disappears on Ctrl+C. No .env is
// read, and every application credential points at this adapter. For state QA,
// stdin accepts: fail-detail on/off, empty on/off, delay on/off, shutdown.
import { spawn } from "node:child_process";
import { randomBytes, createHmac, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createIsolatedAdapter } from "./isolated-adapter.mjs";

const isolated = await createIsolatedAdapter();
const { db, env } = isolated;
const admin = randomBytes(32).toString("hex"), viewer = randomBytes(32).toString("hex");
const hash = value => createHmac("sha256", env.SESSION_SECRET).update(value).digest("hex");
const pin = randomUUID();
await db.query("insert into public.viewer_pins(id,label,pin_hash,expires_at) values($1,'Yerel izleyici',$2,now()+interval '7 days')", [pin, hash("1234567890")]);
await db.query("insert into public.app_sessions(token_hash,role,pin_id,expires_at) values($1,'admin',null,now()+interval '7 days'),($2,'viewer',$3,now()+interval '7 days')", [hash(admin), hash(viewer), pin]);
const goldens = JSON.parse(await readFile("tests/fixtures/tyt/goldens.json", "utf8"));
const examIds = [];
for (let i = 0; i < 8; i++) {
  const source = structuredClone(goldens[i % goldens.length]);
  delete source.file; delete source.sha256;
  source.warnings = [];
  source.exam.name = `${source.exam.name} · Yerel örnek ${i + 1}`;
  source.exam.exam_date = new Date(Date.UTC(2026, 8, 4 + i * 7)).toISOString().slice(0, 10);
  source.exam.report_generated_at = null;
  // Cancelled and unmapped cases stay local. The golden subject totals are
  // recomputed below so the official results still credit cancellations.
  if (i === 3) { const q = source.questions.find(q => q.subject_id === "tyt_math"); q.correct_answer = "İPTAL"; q.selected_answer = null; q.topic_label = "İPTAL"; }
  if (i === 0) source.questions.find(q => q.subject_id === "tyt_physics").topic_label = "Tek gözlem: Fizikte ölçüm";
  if (i === 6) source.questions.find(q => q.subject_id === "tyt_turkish").topic_label = "Birleşik konu etiketi";
  const direct = source.subjects.filter(row => row.result_scope === "direct");
  for (const row of direct) {
    const questions = source.questions.filter(q => q.subject_id === row.subject_id);
    row.correct_count = questions.filter(q => q.correct_answer === "İPTAL" || q.selected_answer === q.correct_answer).length;
    row.wrong_count = questions.filter(q => q.correct_answer !== "İPTAL" && q.selected_answer && q.selected_answer !== q.correct_answer).length;
    row.blank_count = questions.length - row.correct_count - row.wrong_count;
    row.net = row.correct_count - row.wrong_count / 4;
  }
  const children = { tyt_social: ["tyt_history","tyt_geography","tyt_philosophy","tyt_religion"], tyt_math: ["tyt_math","tyt_geometry"], tyt_science: ["tyt_physics","tyt_chemistry","tyt_biology"] };
  for (const row of source.subjects.filter(row => row.result_scope === "aggregate")) {
    const parts = direct.filter(part => children[row.subject_id].includes(part.subject_id));
    for (const field of ["correct_count","wrong_count","blank_count","net"]) row[field] = parts.reduce((sum, part) => sum + part[field], 0);
  }
  for (const [field, resultField] of [["total_correct","correct_count"],["total_wrong","wrong_count"],["total_blank","blank_count"],["total_net","net"]]) source.exam[field] = direct.reduce((sum,row) => sum + row[resultField], 0);
  const result = (await db.query("select public.import_tyt_exam($1::jsonb,$2) result", [JSON.stringify(source), hash(admin)])).rows[0].result;
  if (result.status !== "imported") throw new Error(`Local seed rejected: ${JSON.stringify(result)}`);
  examIds.push(result.exam_id);
}
// Exercise a single-exam observation mapped to a real group without changing
// the import pipeline's ambiguity rules for production.
await db.exec("update public.topics set group_id=(select id from public.topic_groups where subject_id='tyt_physics' and name='Fizik bilimine giriş') where name='Tek gözlem: Fizikte ölçüm'");
const single = (await db.query("select group_id from public.topics where name='Tek gözlem: Fizikte ölçüm'")).rows[0];
if (!single?.group_id) throw new Error("Single-observation seed must belong to a curriculum group");
const origin = "http://127.0.0.1:3457";
const preview = { origin, adminCookie: `yks_session=${admin}`, viewerCookie: `yks_session=${viewer}`, examIds, controlOrigin:env.SUPABASE_URL, controlKey:env.SUPABASE_SERVICE_ROLE_KEY };
await mkdir(".impeccable/review", { recursive: true });
await writeFile(".impeccable/review/isolated-session.json", JSON.stringify(preview, null, 2));
console.log(`ISOLATED_READY ${origin}\nAdmin cookie: yks_session=${admin}\nViewer cookie: yks_session=${viewer}\n8 TYT exams seeded. Login: admin@example.test / test-password; viewer PIN: 1234567890`);
let empty = false;
let commandQueue = Promise.resolve();
isolated.state.control = async command => {
  if (command === "fail-detail on") isolated.state.failDetail = true;
  else if (command === "fail-detail off") isolated.state.failDetail = false;
  else if (command === "delay on") isolated.state.delayMs = 2000;
  else if (command === "delay off") isolated.state.delayMs = 0;
  else if (command === "empty on") { if (!empty) { await db.exec("begin; delete from public.exams;"); empty = true; } }
  else if (command === "empty off") { if (empty) { await db.exec("rollback;"); empty = false; } }
  else throw new Error("Unsupported isolated state command");
};
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => {
  commandQueue = commandQueue.then(async () => {
    for (const command of chunk.trim().split(/\r?\n/)) {
      if (command === "shutdown") { await close(); return; }
      await isolated.state.control(command);
      console.log(`ISOLATED_STATE ${command}`);
    }
  }).catch(error => console.error("Isolated QA command failed:", error.message));
});
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3457"], { env: { ...process.env, ...env, YKS_ISOLATED: "1" }, stdio: "inherit", windowsHide: true });
let closing = false;
async function close() { if (closing) return; closing = true; process.stdin.pause(); child.kill(); await isolated.close(); }
process.on("SIGINT", () => { void close(); });
process.on("SIGTERM", () => { void close(); });
child.on("exit", async code => { await close(); process.exitCode = code ?? 0; });
