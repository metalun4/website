import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { goldens, fixtureBytes, fixtureReport } from "./fixtures";
import { extractPdf, MAX_PDF_BYTES } from "../src/lib/exam-import/extract";
import { parsePdf } from "../src/lib/exam-import/parse";
import { validateExam } from "../src/lib/exam-import/validate";
import { normalizeTopic, turkishDate, turkishNumber, solutionUrl } from "../src/lib/exam-import/normalize";
import { resolveTopic } from "../src/lib/exam-import/topics";
import { sha256, signReceipt, readReceipt, verifyReceipt } from "../src/lib/exam-import/receipt";
import { calculateExam } from "../src/app/yks27/tyt/data";

for (const golden of goldens) test(`actual PDF: ${golden.exam.exam_date}, every question, topic, link, subject cell and ranking`, async () => {
  assert.equal(sha256(await fixtureBytes(golden.file)), golden.sha256, "Fixture must match the independently inspected original");
  const actual = await fixtureReport(golden.file);
  assert.deepEqual(actual.exam, golden.exam);
  assert.deepEqual(actual.subjects, golden.subjects);
  assert.deepEqual(actual.rankings, golden.rankings);
  assert.deepEqual(actual.questions, golden.questions);
  assert.deepEqual(actual.questions.filter(q => q.subject_id === "tyt_geometry").map(q => q.question_number), [31,32,33,34,35,36,37,38,39,40]);
  assert.equal(actual.subjects.length, 13);
  assert.equal(actual.questions.length, 120);
  assert.ok(!JSON.stringify(actual).includes("booklet"));
});
test("September 4 negative Geometry net and October 2 independently rounded Mathematics average survive", async () => {
  const first = await fixtureReport();
  assert.equal(first.subjects.find(s => s.subject_id === "tyt_geometry")!.net, -.25);
  const fourth = await fixtureReport("u6krt_69xh.pdf");
  assert.equal(fourth.subjects.find(s => s.subject_id === "tyt_math" && s.result_scope === "aggregate")!.average_net, 14.21);
  assert.equal(fourth.subjects.find(s => s.subject_id === "tyt_math" && s.result_scope === "direct")!.average_net, 12.88);
  assert.equal(calculateExam({ date: "2026-10-02", name: "Example", rank: null, participants: null, average_net: 60.53, subjects: [{ correct:30,incorrect:6,average:27.8 },{ correct:17,incorrect:3,average:13.17 },{ correct:7,incorrect:0,average:14.21 },{ correct:4,incorrect:2,average:5.36 }] }).average, 60.53, "Charts must use the explicitly reported overall average");
});
test("partial solution-link coverage leaves missing URLs null without shifting remaining questions", async () => {
  const layout = await extractPdf(await fixtureBytes("4xsy3iur3t.pdf"));
  const before = parsePdf(layout);
  assert.equal(layout.pages[1].links.length,120);
  layout.pages[1].links = layout.pages[1].links.slice(3);
  const after = parsePdf(layout);
  assert.equal(after.questions.filter(q=>q.solution_url).length,117);
  assert.ok(after.questions.slice(0,3).every(q=>q.solution_url===null));
  assert.deepEqual(after.questions.slice(3),before.questions.slice(3));
});
test("additional complete 345 report is supported independently of the six-exam acceptance set", async () => {
  const report = await fixtureReport("c70a143a700c7f89863b1aaece513dc8542ca807.pdf");
  assert.equal(report.exam.exam_date,"2026-10-19");
  assert.equal(report.exam.score,308.25);
  assert.equal(report.exam.total_net,58);
  assert.deepEqual([report.exam.total_correct,report.exam.total_wrong,report.exam.total_blank],[62,16,42]);
  assert.equal(report.questions.filter(q=>q.solution_url).length,120);
});
test("historical records cannot supply or override report fields", async () => {
  const layout = await extractPdf(await fixtureBytes("qksssu3nm_.pdf"));
  const before = parsePdf(layout);
  const start = layout.pages[0].text.find(t => /SON 6 SINAVIN/.test(t.text));
  assert.ok(start);
  // Change only the history region, retaining the footer. Make its contents
  // look like plausible conflicting current-report totals and headings.
  for (const t of layout.pages[0].text) if (t.y > start.y + 10 && t.y < layout.pages[0].height * .9) t.text = "TYT 999,99 120 120 0 0";
  assert.deepEqual(parsePdf(layout), before);
  layout.pages[0].text = layout.pages[0].text.filter(t => !t.text.includes("Sınav Adı"));
  assert.throws(() => parsePdf(layout), /başlığı/);
});
test("absent optional score, averages, timestamp and history remain absent", async () => {
  const layout = await extractPdf(await fixtureBytes("qksssu3nm_.pdf"));
  const page = layout.pages[0];
  const history = page.text.find(t => /SON 6 SINAVIN/.test(t.text))!;
  const score = page.text.find(t => t.text === "332,04")!;
  // The averages occupy the final DERS ANALİZİ column, before rankings.
  const ort = page.text.find(t => t.text === "ORT")!;
  const ranking = page.text.find(t => t.text === "PUAN VE SIRALAMALAR")!;
  page.text = page.text.filter(t => t !== score && !(t.y > ort.y + 2 && t.y < ranking.y && t.x >= ort.x - 12) && t.y < history.y);
  const parsed = parsePdf(layout);
  assert.equal(parsed.exam.score,null);
  assert.equal(parsed.exam.average_net,null);
  assert.equal(parsed.exam.report_generated_at,null);
  assert.ok(parsed.subjects.every(r=>r.average_net===null));
});
test("answer, subject, duplicate physical question, rank, and aggregate inconsistencies fail closed", async () => {
  const original = await fixtureReport();
  const mutations = [
    (r: typeof original) => { r.questions[0].selected_answer = r.questions[0].selected_answer === null ? "A" : null; },
    (r: typeof original) => { r.questions[0].subject_id = "tyt_social"; },
    (r: typeof original) => { r.questions[1] = { ...r.questions[0] }; },
    (r: typeof original) => { r.subjects.find(s => s.result_scope === "aggregate")!.question_count++; },
    (r: typeof original) => { r.rankings[0].rank = r.rankings[0].participant_count + 1; },
    (r: typeof original) => { r.questions[0].topic_label = "Unreadable\u0000"; },
  ];
  for (const mutate of mutations) { const r = structuredClone(original); mutate(r); assert.throws(() => validateExam(r)); }
});
test("truncated topics stay provisional even if one canonical prefix match exists", () => {
  const existing = [{ id:"test",subject_id:"tyt_turkish",name:"Paragrafta Yardımcı Düşünceler",normalized_name:normalizeTopic("Paragrafta Yardımcı Düşünceler"),needs_review:false }];
  assert.equal(resolveTopic("tyt_turkish", "Paragrafta Yardımcı Düşü…", existing).create?.needs_review, true);
  assert.equal(resolveTopic("tyt_turkish", "PARAGRAFTA YARDIMCI DÜŞÜNCELER", existing).existing?.id, "test");
  assert.equal(resolveTopic("tyt_math", "Paragrafta Yardımcı Düşünceler", existing).existing, null);
  assert.equal(normalizeTopic("  IŞIK\u00a0İLİŞKİSİ  "), "ışık ilişkisi");
});
test("Turkish numbers, dates and external-link validation", () => {
  for (const [s,n] of [["67,25",67.25],["332,04",332.04],["21.092",21092],["-0,25",-.25]] as const) assert.equal(turkishNumber(s), n);
  for (const value of ["", "67.25", "1,2,3", "missing"]) assert.throws(() => turkishNumber(value));
  assert.equal(turkishDate("09.10.2026"), "2026-10-09");
  assert.throws(() => turkishDate("31.02.2026"));
  for (const url of ["javascript:alert(1)", "file:///tmp/a", "https://user:pass@example.com/"]) assert.equal(solutionUrl(url), null);
});
test("confirmation receipts are bound to the file, parsed report, admin session, and expiry", () => {
  const token = signReceipt("file", "report", "session", "secret", 1000);
  assert.deepEqual(readReceipt(token,"file","session","secret",2000),{reportHash:"report"});
  assert.throws(()=>readReceipt(token,"different file","session","secret",2000));
  assert.doesNotThrow(() => verifyReceipt(token, "file", "report", "session", "secret", 2000));
  for (const [f,r,s,now] of [["other","report","session",2000],["file","changed","session",2000],["file","report","viewer",2000],["file","report","session",601001]] as const) assert.throws(() => verifyReceipt(token, f,r,s,"secret",now));
  assert.throws(() => verifyReceipt(`${token}x`, "file", "report", "session", "secret", 2000));
});
test("malformed, oversized, unrelated, combined and cancelled-answer PDFs are rejected", async () => {
  await assert.rejects(extractPdf(Buffer.from("not a PDF")));
  await assert.rejects(extractPdf(new Uint8Array(MAX_PDF_BYTES + 1)));
  const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) doc.addPage().drawText("This unrelated document contains readable text that is not an individual exam report. ".repeat(20), { font, size: 9 });
  await assert.rejects(extractPdf(await doc.save()).then(parsePdf));
  for (let i = 0; i < 3; i++) doc.addPage();
  await assert.rejects(extractPdf(await doc.save()), /iki sayfalık/);
  await assert.rejects(extractPdf(await fixtureBytes("5ade3e51cd986a20854fff3770ec091034061db5.pdf")).then(parsePdf), /iptal/);
});
