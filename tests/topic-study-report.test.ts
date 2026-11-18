import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildStudyReport, selectStudySummary, studyBucketDisplayOrder, studyBucketLabels, studySectionId } from "../src/lib/topic-study-report";
import type { StudyAnalysis } from "../src/lib/topic-study-view";
import { questionHref } from "../src/lib/topic-stats";
import { StudyAnalysisSection } from "../src/app/yks27/tyt/[examId]/study-analysis";
import { studyReportFixture, withoutEligible } from "./topic-study-report-fixtures";

test("join uses question ids, loaded outcomes and original labels; grouping keeps subject and group identities", () => {
  const { analysis, exam } = studyReportFixture();
  const original = structuredClone({ analysis, exam });
  exam.exam_questions.reverse();
  analysis.questions!.reverse();
  analysis.questions![0].id = analysis.questions![0].id.toUpperCase();
  const report = buildStudyReport(analysis, exam);
  assert.equal(report.summary.state, "misses");
  assert.equal(report.issue, undefined);
  assert.deepEqual(report.subjects.map(row => row.subject.id), ["tyt_turkish", "tyt_biology"]);
  assert.deepEqual(report.subjects[0].groups.map(group => group.id), ["group-one", "other-group"]);
  assert.deepEqual(report.subjects[0].groups[0].misses.map(miss => [miss.question.question_number, miss.question.topic.name, miss.outcome]), [[7, "Özgün konu 7", "incorrect"], [8, "Özgün konu 8", "blank"]]);
  assert.equal(report.subjects[1].groups[0].id, "group-one");
  assert.equal(report.subjects.flatMap(subject => subject.groups.flatMap(group => group.misses)).length, 4);
  assert.deepEqual(exam.exam_questions.toReversed(), original.exam.exam_questions);
});

test("each report state is explicit, including first use, no misses, no denominator, unavailable and request failure", () => {
  const { analysis, exam } = studyReportFixture();
  assert.equal(buildStudyReport(null, exam).summary.state, "error");
  const unavailable: StudyAnalysis = { status: "unavailable", reason: "incomplete_questions", examId: exam.id, examDate: exam.exam_date, hasStudyRecords: false, counts: null, postStudy: null };
  assert.equal(buildStudyReport(unavailable, exam).summary.state, "unavailable");
  assert.equal(selectStudySummary(analysis).state, "misses");
  const noEligible = withoutEligible(analysis);
  assert.equal(buildStudyReport(noEligible, exam).summary.state, "no_eligible");
  noEligible.hasStudyRecords = false;
  // First-use SQL cannot contain same-day or pre-study questions either.
  for (const bucket of ["same_day", "pre_study"] as const) {
    noEligible.counts.missing_completion += noEligible.counts[bucket];
    noEligible.counts[bucket] = 0;
  }
  noEligible.questions = noEligible.questions!.map(question => question.bucket === "same_day" || question.bucket === "pre_study" ? { ...question, bucket: "missing_completion", completedOn: null } : question);
  assert.equal(buildStudyReport(noEligible, exam).summary.state, "first_use");
  for (const question of exam.exam_questions) if (question.correct_answer !== "İPTAL") question.selected_answer = question.correct_answer;
  analysis.postStudy = { correct: 5, wrong: 0, blank: 0 };
  const noMisses = buildStudyReport(analysis, exam);
  assert.equal(noMisses.summary.state, "no_misses");
  assert.deepEqual(noMisses.subjects, []);
  const html = renderToStaticMarkup(createElement(StudyAnalysisSection, { analysis, exam }));
  assert.match(html, /Bu denemede, konuların bitirildiği tarihten sonra sorulan sorularda yanlış veya boş yok/);
  assert.doesNotMatch(html, /%|başarılı|ustalaş/);
});

test("all six bucket counts account for exactly the imported total; a mismatch is unavailable", () => {
  const { analysis, exam } = studyReportFixture();
  assert.equal(studyBucketDisplayOrder.reduce((total, bucket) => total + analysis.counts[bucket], 0), exam.total_questions);
  for (const bucket of studyBucketDisplayOrder) {
    const changed = structuredClone(analysis);
    changed.counts[bucket]++;
    const report = buildStudyReport(changed, exam);
    assert.equal(report.summary.state, "unavailable");
    assert.equal(report.issue?.reason, "counts");
    assert.deepEqual(report.subjects, []);
  }
  assert.equal(buildStudyReport(analysis, { ...exam, total_questions: 120 }).issue?.reason, "counts");
  const changed = structuredClone(analysis);
  changed.questions![0].bucket = "unmapped";
  assert.equal(buildStudyReport(changed, exam).issue?.reason, "counts");
});

test("questions missing on either side, duplicate ids and missing detail arrays never silently disappear", () => {
  const { analysis, exam } = studyReportFixture();
  const missingQuestion = buildStudyReport(analysis, { ...exam, exam_questions: exam.exam_questions.slice(1) });
  assert.equal(missingQuestion.summary.state, "unavailable");
  assert.deepEqual(missingQuestion.issue?.missingFromQuestions, [analysis.questions![0].id]);
  const missingAnalysis = buildStudyReport({ ...analysis, questions: analysis.questions!.slice(1) }, exam);
  assert.equal(missingAnalysis.summary.state, "unavailable");
  assert.deepEqual(missingAnalysis.issue?.missingFromAnalysis, [exam.exam_questions[0].id]);
  assert.equal(buildStudyReport({ ...analysis, questions: undefined }, exam).issue?.reason, "question_ids");
  assert.equal(buildStudyReport({ ...analysis, questions: [...analysis.questions!, analysis.questions![0]] }, exam).issue?.reason, "question_ids");
  assert.equal(buildStudyReport(analysis, { ...exam, exam_questions: [...exam.exam_questions, exam.exam_questions[0]] }).issue?.reason, "question_ids");
  const replaced = structuredClone(analysis);
  replaced.questions![0].id = "only-in-analysis";
  const mismatch = buildStudyReport(replaced, exam);
  assert.deepEqual(mismatch.issue?.missingFromQuestions, ["only-in-analysis"]);
  assert.deepEqual(mismatch.issue?.missingFromAnalysis, [exam.exam_questions[0].id]);
});

test("different snapshots, missing subjects and changed loaded outcomes fail explicitly without reclassifying buckets", () => {
  const { analysis, exam } = studyReportFixture();
  assert.equal(buildStudyReport({ ...analysis, examId: "other-exam" }, exam).issue?.reason, "exam");
  assert.equal(buildStudyReport({ ...analysis, examDate: "2026-11-13" }, exam).issue?.reason, "exam");
  assert.equal(buildStudyReport(analysis, { ...exam, exam_subject_results: [] }).issue?.reason, "subjects");
  exam.exam_questions[6].selected_answer = "A";
  assert.equal(buildStudyReport(analysis, exam).issue?.reason, "outcomes");
  exam.exam_questions[6].correct_answer = "İPTAL";
  assert.equal(buildStudyReport(analysis, exam).issue?.reason, "outcomes");
});

test("a single eligible blank is shown immediately; dates never cause TypeScript to re-derive a bucket", () => {
  const { analysis, exam } = studyReportFixture();
  const question = exam.exam_questions[7];
  const study = analysis.questions![7];
  analysis.questions = [{ ...study, completedOn: "2026-11-14" }];
  analysis.counts = { cancelled: 0, unmapped: 0, missing_completion: 0, same_day: 0, pre_study: 0, post_study: 1 };
  analysis.postStudy = { correct: 0, wrong: 0, blank: 1 };
  const report = buildStudyReport(analysis, { ...exam, exam_questions: [question], total_questions: 1 });
  assert.equal(report.summary.state, "misses");
  assert.equal(report.subjects[0].groups[0].misses[0].question.id, question.id);
});

test("report rendering exposes counts, labelled exact-question links and only safe solution URLs", () => {
  const { analysis, exam } = studyReportFixture();
  exam.exam_questions[7].solution_url = "javascript:alert(1)";
  const html = renderToStaticMarkup(createElement(StudyAnalysisSection, { analysis, exam }));
  assert.ok(html.includes(`id="${studySectionId}"`));
  for (const bucket of studyBucketDisplayOrder) assert.ok(html.includes(studyBucketLabels[bucket]));
  assert.match(html, /5 soru/);
  assert.match(html, /1 doğru · 3 yanlış · 1 boş/);
  assert.ok(html.includes(`href="${questionHref(exam.id, "tyt_turkish", 7)}"`));
  assert.match(html, /https:\/\/example.test\/solution.pdf#page=3/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /Çözüm bağlantısı yok/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /Bitirdiğim tarih:/);
  assert.match(html, /10 Kasım 2026/);
  assert.match(html, /12 Kasım 2026/);
});

test("rendered empty and failed states cannot be mistaken for perfect results or full missing-information breakdowns", () => {
  const { analysis, exam } = studyReportFixture();
  const render = (value: StudyAnalysis | null) => renderToStaticMarkup(createElement(StudyAnalysisSection, { analysis: value, exam }));
  const first = withoutEligible(analysis);
  first.hasStudyRecords = false;
  const firstHtml = render(first);
  assert.match(firstHtml, /href="\/yks27\/tyt\/study"/);
  assert.doesNotMatch(firstHtml, /Tüm soruların dağılımı|İşlenme bilgisi eksik|doğru ·/);
  const zero = render(withoutEligible(analysis));
  assert.match(zero, /Sonuç değerlendirilemiyor/);
  assert.match(zero, /Tüm soruların dağılımı/);
  assert.doesNotMatch(zero, /yanlış veya boş yok|%/);
  const failed = render(null);
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Sayfayı yenileyip tekrar dene/);
  assert.doesNotMatch(failed, /Tüm soruların dağılımı/);
  const unavailable = render({ status: "unavailable", reason: "incomplete_questions", examId: exam.id, examDate: exam.exam_date, hasStudyRecords: true, counts: null, postStudy: null });
  assert.match(unavailable, /şu anda kullanılamıyor/);
  assert.doesNotMatch(unavailable, /yüklenemedi|yanlış veya boş yok/);
});
