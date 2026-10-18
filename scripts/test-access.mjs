// Production-server integration checks with an isolated, in-memory Supabase API double.
// Run after npm run build: node scripts/test-access.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";

const adminId = randomUUID();
const tables = { exams: [], viewer_pins: [], app_sessions: [] };
let limited = false;
const api = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : null;
  res.setHeader("Content-Type", "application/json");
  assert.equal(req.headers.apikey, "test-server-key");
  if (url.pathname === "/auth/v1/token") {
    if (body.email !== "admin@example.test" || body.password !== "test-password") {
      res.writeHead(400).end(JSON.stringify({ error: "invalid credentials" }));
    } else res.end(JSON.stringify({ user: { id: adminId } }));
    return;
  }
  if (url.pathname.endsWith("/rpc/consume_login_attempt")) return res.end(JSON.stringify(!limited));
  const name = url.pathname.split("/").at(-1);
  const table = tables[name];
  if (!table) return res.writeHead(404).end("{}");
  const matches = row => [...url.searchParams].every(([key, filter]) => {
    if (["select", "order", "limit"].includes(key)) return true;
    if (filter.startsWith("eq.")) return String(row[key]) === filter.slice(3);
    if (filter.startsWith("gt.")) return row[key] > filter.slice(3);
    throw new Error(`Unhandled query: ${key}=${filter}`);
  });
  let rows = table.filter(matches);
  if (req.method === "POST") {
    const row = { id: randomUUID(), revoked: false, created_at: new Date().toISOString(), ...body };
    table.push(row);
    rows = [row];
  } else if (req.method === "PATCH") rows.forEach(row => Object.assign(row, body));
  else if (req.method === "DELETE") tables[name] = table.filter(row => !matches(row));
  res.end(JSON.stringify(rows));
});
api.listen(0, "127.0.0.1");
await once(api, "listening");
const port = 3197;
const origin = `http://localhost:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: { ...process.env, VERCEL: "", SUPABASE_URL: `http://127.0.0.1:${api.address().port}`, SUPABASE_SERVICE_ROLE_KEY: "test-server-key", ADMIN_USER_ID: adminId, SESSION_SECRET: "isolated-integration-test-secret-at-least-32-chars" },
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
let logs = "";
child.stdout.on("data", chunk => { logs += chunk; });
child.stderr.on("data", chunk => { logs += chunk; });
const get = (path, cookie = "") => fetch(origin + path, { headers: { cookie }, redirect: "manual" });
const decode = text => text.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
function form(html, marker) {
  const match = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].find(m => m[1].includes(marker));
  assert.ok(match, `Form containing ${marker} exists`);
  const data = new FormData();
  for (const input of match[1].matchAll(/<input\b[^>]*>/g)) {
    const name = input[0].match(/name="([^"]*)"/)?.[1];
    const value = input[0].match(/value="([^"]*)"/)?.[1];
    if (name && input[0].includes('type="hidden"')) data.append(decode(name), decode(value ?? ""));
  }
  return data;
}
async function post(path, data, cookie = "") {
  return fetch(origin + path, { method: "POST", body: data, headers: { cookie, Origin: origin }, redirect: "manual" });
}
const cookieOf = response => response.headers.getSetCookie().find(value => value.startsWith("yks_session=") && !value.startsWith("yks_session=;"))?.split(";")[0];
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await get("/yks27/login")).status === 200) break; } catch { /* server starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  for (const path of ["/yks27/tyt", "/yks27/tyt/dashboard", "/yks27/admin"]) {
    const response = await get(path);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "/yks27/login");
  }
  const loginHtml = await (await get("/yks27/login")).text();
  const bad = form(loginHtml, 'name="mode"');
  bad.set("mode", "admin"); bad.set("email", "admin@example.test"); bad.set("password", "wrong");
  assert.equal(cookieOf(await post("/yks27/login", bad)), undefined);
  const credentials = form(loginHtml, 'name="mode"');
  credentials.set("mode", "admin"); credentials.set("email", "admin@example.test"); credentials.set("password", "test-password");
  const signedIn = await post("/yks27/login", credentials);
  assert.equal(signedIn.status, 303);
  assert.equal(signedIn.headers.get("location"), "/yks27/tyt");
  const admin = cookieOf(signedIn);
  assert.ok(admin);
  assert.match(signedIn.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(signedIn.headers.get("set-cookie"), /Secure/i);
  assert.match(await (await get("/yks27/tyt", admin)).text(), /Henüz deneme kaydı yok/);
  let adminHtml = await (await get("/yks27/admin", admin)).text();
  const invalid = form(adminHtml, 'name="name"');
  invalid.set("name", "Invalid"); invalid.set("date", "2026-10-18"); invalid.set("turkce.correct", "40"); invalid.set("turkce.incorrect", "1");
  assert.match(await (await post("/yks27/admin", invalid, admin)).text(), /soru sayısı aşıldı/);
  assert.equal(tables.exams.length, 0);
  invalid.set("turkce.correct", "0"); invalid.set("turkce.incorrect", "0");
  for (const url of ["javascript:alert(1)", "ftp://example.test/exam.pdf", "https://", "https://user:password@example.test/exam.pdf"]) {
    invalid.set("pdf_url", url);
    assert.match(await (await post("/yks27/admin", invalid, admin)).text(), /Geçerli bir HTTP veya HTTPS PDF bağlantısı/);
    assert.equal(tables.exams.length, 0);
  }
  const create = form(adminHtml, 'name="name"');
  create.set("name", "Private integration exam"); create.set("date", "2026-10-18");
  for (const key of ["turkce", "sosyal", "matematik", "fen"]) {
    create.set(`${key}.net`, "999"); create.set(`${key}.average`, "8"); create.set(`${key}.correct`, "11"); create.set(`${key}.incorrect`, "4");
  }
  assert.equal((await post("/yks27/admin", create, admin)).status, 303);
  assert.equal(tables.exams.length, 1);
  assert.equal(tables.exams[0].pdf_url, null, "PDF is optional");
  assert.doesNotMatch(await (await get("/yks27/tyt", admin)).text(), /PDF’yi görüntüle/);
  for (const subject of tables.exams[0].subjects) {
    assert.deepEqual(Object.keys(subject).sort(), ["average", "correct", "incorrect"], "Only raw subject inputs are persisted; submitted net is ignored");
  }
  assert.deepEqual(tables.exams[0].subjects.map(subject => [subject.correct, subject.incorrect]), [[11, 4], [11, 4], [11, 4], [11, 4]]);
  const examId = tables.exams[0].id;
  const editHtml = await (await get(`/yks27/admin?edit=${examId}`, admin)).text();
  const edit = form(editHtml, 'name="name"'); edit.set("name", "Updated private exam"); edit.set("date", "2026-10-19");
  const pdfUrl = "https://example.test/exam.pdf?token=abc&download=1";
  edit.set("pdf_url", pdfUrl);
  for (const key of ["turkce", "sosyal", "matematik", "fen"]) {
    edit.set(`${key}.correct`, "0"); edit.set(`${key}.incorrect`, key === "fen" ? "20" : "0");
  }
  edit.set("turkce.correct", "31"); edit.set("turkce.incorrect", "6");
  assert.equal((await post("/yks27/admin", edit, admin)).status, 303);
  assert.equal(tables.exams[0].name, "Updated private exam");
  assert.equal(tables.exams[0].pdf_url, pdfUrl);
  assert.deepEqual(tables.exams[0].subjects.map(subject => [subject.correct, subject.incorrect]), [[31, 6], [0, 0], [0, 0], [0, 20]]);
  assert.ok(tables.exams[0].subjects.every(subject => !("net" in subject) && !("empty" in subject)));
  const updatedHtml = await (await get(`/yks27/admin?edit=${examId}`, admin)).text();
  assert.match(updatedHtml, /name="pdf_url"[^>]*value="https:\/\/example.test\/exam.pdf\?token=abc&amp;download=1"/);
  const turkceFields = updatedHtml.match(/<fieldset[^>]*>[\s\S]*?<\/fieldset>/)?.[0];
  assert.match(turkceFields, /Boş<input[^>]*readOnly=""[^>]*value="3"/);
  assert.match(turkceFields, /Net<input[^>]*readOnly=""[^>]*value="29.5"/);
  adminHtml = await (await get("/yks27/admin", admin)).text();
  const pinData = form(adminHtml, 'name="label"'); pinData.set("label", "Test viewer"); pinData.set("days", "30");
  const pinHtml = await (await post("/yks27/admin", pinData, admin)).text();
  const pin = pinHtml.match(/<output[^>]*>(\d{10})<\/output>/)?.[1];
  assert.ok(pin, "Generated PIN appears once in action response");
  assert.notEqual(tables.viewer_pins[0].pin_hash, pin);
  const viewerLogin = form(loginHtml, 'name="mode"'); viewerLogin.set("mode", "viewer"); viewerLogin.set("pin", pin);
  const viewer = cookieOf(await post("/yks27/login", viewerLogin));
  assert.ok(viewer);
  const listingResponse = await get("/yks27/tyt", viewer);
  assert.equal(listingResponse.status, 200);
  const listing = await listingResponse.text();
  assert.match(listing, /href="\/yks27\/tyt\/dashboard"/);
  assert.match(listing, /Updated private exam/);
  assert.match(listing, /href="https:\/\/example.test\/exam.pdf\?token=abc&amp;download=1" target="_blank" rel="noopener noreferrer"/);
  assert.match(listing, /PDF’yi görüntüle/);
  for (const label of ["Türkçe", "Sosyal", "Matematik", "Fen", "Doğru", "Yanlış", "Boş", "Net"]) assert.ok(listing.includes(label));
  const totalRow = listing.match(/<tfoot[\s\S]*?<\/tfoot>/)?.[0];
  assert.ok(totalRow);
  const totals = [...totalRow.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(match => match[1]);
  assert.deepEqual(totals, ["120", "31", "26", "63", "24,50", "Veri yok"]);
  assert.doesNotMatch(listing, /Düzenle|Kayıtlar ve PIN yönetimi/);
  const chartResponse = await get("/yks27/tyt/dashboard", viewer);
  assert.equal(chartResponse.status, 200);
  const charts = await chartResponse.text();
  assert.match(charts, /Updated private exam/);
  assert.match(charts, /24,50/, "Charts calculate total net from stored answer counts");
  assert.match(charts, /Salt okunur/);
  assert.doesNotMatch(charts, /Kayıtlar ve PIN yönetimi/);
  assert.equal((await get("/yks27/admin", viewer)).headers.get("location"), "/yks27/tyt");
  // Replay a real admin mutation as a viewer: the server must reject it.
  const viewerForgery = await post("/yks27/admin", create, viewer);
  assert.equal(viewerForgery.status, 303);
  assert.equal(viewerForgery.headers.get("location"), "/yks27/tyt");
  assert.equal(tables.exams.length, 1);
  const privilegedForms = [
    edit,
    pinData,
    form(adminHtml = await (await get("/yks27/admin", admin)).text(), `value="${examId}"`),
    form(adminHtml, `value="${tables.viewer_pins[0].id}"`),
  ];
  const snapshot = JSON.stringify({ exams: tables.exams, pins: tables.viewer_pins });
  for (const forbidden of privilegedForms) {
    assert.equal((await post("/yks27/admin", forbidden, viewer)).headers.get("location"), "/yks27/tyt");
    assert.equal(JSON.stringify({ exams: tables.exams, pins: tables.viewer_pins }), snapshot);
  }
  const anonForgery = await post("/yks27/admin", create);
  assert.equal(anonForgery.headers.get("location"), "/yks27/login");
  assert.equal(tables.exams.length, 1);
  edit.set("pdf_url", "");
  assert.equal((await post("/yks27/admin", edit, admin)).status, 303);
  assert.equal(tables.exams[0].pdf_url, null, "Clearing the optional URL removes the saved link");
  assert.doesNotMatch(await (await get("/yks27/tyt", viewer)).text(), /PDF’yi görüntüle/);
  const expiredSession = tables.app_sessions.find(row => row.role === "viewer");
  const originalExpiry = expiredSession.expires_at;
  expiredSession.expires_at = "2000-01-01T00:00:00Z";
  assert.equal((await get("/yks27/tyt", viewer)).headers.get("location"), "/yks27/login");
  assert.equal((await get("/yks27/tyt/dashboard", viewer)).headers.get("location"), "/yks27/login");
  expiredSession.expires_at = originalExpiry;
  const originalPinExpiry = tables.viewer_pins[0].expires_at;
  tables.viewer_pins[0].expires_at = "2000-01-01T00:00:00Z";
  assert.equal((await get("/yks27/tyt", viewer)).headers.get("location"), "/yks27/login");
  tables.viewer_pins[0].expires_at = originalPinExpiry;
  const revoke = form(adminHtml = await (await get("/yks27/admin", admin)).text(), `value="${tables.viewer_pins[0].id}"`);
  await post("/yks27/admin", revoke, admin);
  assert.equal(tables.viewer_pins[0].revoked, true);
  assert.equal((await get("/yks27/tyt", viewer)).headers.get("location"), "/yks27/login");
  const remove = form(adminHtml, `value="${examId}"`);
  await post("/yks27/admin", remove, admin);
  assert.equal(tables.exams.length, 0);
  limited = true;
  assert.match(await (await post("/yks27/login", credentials)).text(), /Çok fazla deneme/);
  const logout = form(adminHtml, "Çıkış yap");
  await post("/yks27/admin", logout, admin);
  assert.equal((await get("/yks27/admin", admin)).headers.get("location"), "/yks27/login");
  console.log("PASS: anonymous protection, admin login/CRUD, validation, viewer PIN login, server mutation denial, session/PIN expiry, revocation, rate-limit response, logout.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill();
  api.closeAllConnections();
  api.close();
}
