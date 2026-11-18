import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildStudyDashboardSummary } from "../src/lib/topic-study-summary";
import { studySectionId } from "../src/lib/topic-study-report";
import type { StudyAnalysis } from "../src/lib/topic-study-view";
import { StudyDashboardSummary } from "../src/app/yks27/tyt/dashboard/study-summary";
import { StudyFirstUsePrompt } from "../src/app/yks27/tyt/study-analysis-ui";
import { studyReportFixture, withoutEligible } from "./topic-study-report-fixtures";

test("summary-only payload uses the selected exam, eligible denominator and wrong plus blank count", () => {
  const { analysis, exam } = studyReportFixture();
  delete analysis.questions;
  const model = buildStudyDashboardSummary(analysis, exam.id);
  assert.equal(model.summary.state, "misses");
  assert.equal(model.href, `/yks27/tyt/${exam.id}#${studySectionId}`);
  assert.equal(model.message, "İşlenen konulardaki 5 soruda 4 yanlış veya boş");
  assert.deepEqual(model.notes, ["Aynı gün · sırası belirtilmedi: 1 soru", "İşlenme bilgisi eksik: 1 soru", "Konu eşlemesi belirsiz: 1 soru"]);
  const wrongExam = buildStudyDashboardSummary(analysis, "22222222-2222-2222-2222-222222222222");
  assert.equal(wrongExam.summary.state, "unavailable");
  assert.equal(wrongExam.message, null);
  assert.equal(wrongExam.href, `/yks27/tyt/22222222-2222-2222-2222-222222222222#${studySectionId}`);
});

test("counts use tr-TR formatting and suffix-free Turkish for every numeric ending", () => {
  const { analysis, exam } = studyReportFixture();
  for (const misses of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 40, 100, 1000]) {
    analysis.counts.post_study = 1234;
    analysis.postStudy = { correct: 1234 - misses, wrong: misses, blank: 0 };
    const model = buildStudyDashboardSummary(analysis, exam.id);
    assert.equal(model.message, `İşlenen konulardaki 1.234 soruda ${misses.toLocaleString("tr-TR")} yanlış veya boş`);
    assert.equal(model.summary.state, misses === 0 ? "no_misses" : "misses");
  }
});

test("zero eligible, first use, unavailable analysis and failed requests retain distinct states", () => {
  const { analysis, exam } = studyReportFixture();
  const zero = withoutEligible(analysis);
  const zeroModel = buildStudyDashboardSummary(zero, exam.id);
  assert.equal(zeroModel.summary.state, "no_eligible");
  assert.match(zeroModel.message!, /sonuç değerlendirilemiyor/);
  assert.doesNotMatch(zeroModel.message!, /0 yanlış|%/);
  zero.hasStudyRecords = false;
  const first = buildStudyDashboardSummary(zero, exam.id);
  assert.equal(first.summary.state, "first_use");
  assert.equal(first.message, null);
  assert.deepEqual(first.notes, []);
  const unavailable: StudyAnalysis = { status: "unavailable", reason: "incomplete_questions", examId: exam.id, examDate: exam.exam_date, hasStudyRecords: true, counts: null, postStudy: null };
  assert.equal(buildStudyDashboardSummary(unavailable, exam.id).summary.state, "unavailable");
  assert.equal(buildStudyDashboardSummary(null, exam.id).summary.state, "error");
});

test("optional unknown counts are compact and absent when zero", () => {
  const { analysis, exam } = studyReportFixture();
  analysis.counts.same_day = 0;
  analysis.counts.missing_completion = 0;
  analysis.counts.unmapped = 0;
  assert.deepEqual(buildStudyDashboardSummary(analysis, exam.id).notes, []);
  analysis.counts.same_day = 2;
  assert.deepEqual(buildStudyDashboardSummary(analysis, exam.id).notes, ["Aynı gün · sırası belirtilmedi: 2 soru"]);
});

test("dashboard rendering links to this exam section and reuses the exact first-use prompt", () => {
  const { analysis, exam } = studyReportFixture();
  const render = (value: StudyAnalysis | null) => renderToStaticMarkup(createElement(StudyDashboardSummary, { analysis: value, examId: exam.id }));
  const html = render(analysis);
  assert.ok(html.includes(`href="/yks27/tyt/${exam.id}#${studySectionId}"`));
  assert.match(html, /5 soruda 4 yanlış veya boş/);
  assert.match(html, /Aynı gün · sırası belirtilmedi: 1 soru/);
  assert.doesNotMatch(html, /yks-summary|<dl/);
  const firstHtml = render({ ...analysis, hasStudyRecords: false });
  assert.ok(firstHtml.includes(renderToStaticMarkup(createElement(StudyFirstUsePrompt))));
  assert.doesNotMatch(firstHtml, /İşlenme bilgisi eksik|soruda/);
  const zeroHtml = render(withoutEligible(analysis));
  assert.match(zeroHtml, /sonuç değerlendirilemiyor/);
  assert.ok(zeroHtml.includes(`href="/yks27/tyt/${exam.id}#${studySectionId}"`));
  const failedHtml = render(null);
  assert.match(failedHtml, /role="alert"/);
  assert.match(failedHtml, /yüklenemedi/);
  assert.doesNotMatch(failedHtml, /soruda|0 yanlış/);
  const unavailableHtml = render({ status: "unavailable", reason: "incomplete_questions", examId: exam.id, examDate: exam.exam_date, hasStudyRecords: true, counts: null, postStudy: null });
  assert.match(unavailableHtml, /şu anda kullanılamıyor/);
  assert.doesNotMatch(unavailableHtml, /yüklenemedi|soruda/);
});
