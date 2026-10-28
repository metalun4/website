import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { goldens, fixtureReport } from "./fixtures";
import { SUBJECTS } from "../src/lib/exam-import/types";
import { filterQuestions, groupQuestions, groupResults, isExamId, questionStatus, type DetailQuestion, type DetailResult } from "../src/lib/exam-detail";
import { QuestionAnalysis } from "../src/app/yks27/tyt/[examId]/question-analysis";

function results(rows: typeof goldens[number]["subjects"]): DetailResult[] {
  return rows.map(row => {
    const index = SUBJECTS.findIndex(subject => subject.id === row.subject_id);
    const definition = SUBJECTS[index];
    return { ...row, subject: { id: definition.id, name: definition.name, parent_id: definition.parent, display_order: index + 1 } };
  });
}
function questions(rows: typeof goldens[number]["questions"]): DetailQuestion[] {
  return rows.map((row, i) => ({ ...row, id: `question-${i}`, topic: { name: row.topic_label, needs_review: /(?:…|\.{3})\s*$/.test(row.topic_label) } }));
}

for (const golden of goldens) test(`detail preserves every stored result, question, topic and answer: ${golden.exam.exam_date}`, () => {
  const groupedResults = groupResults(results(golden.subjects));
  assert.equal(groupedResults.flatMap(group => group.rows).length, 13);
  assert.deepEqual(groupedResults.map(group => group.rows.length), [1, 5, 3, 4]);
  const math = groupedResults[2].rows;
  assert.deepEqual(math.map(row => [row.subject_id, row.result_scope, row.question_count]), [["tyt_math", "direct", 30], ["tyt_geometry", "direct", 10], ["tyt_math", "aggregate", 40]]);
  const grouped = groupQuestions(results(golden.subjects).reverse(), questions(golden.questions).reverse());
  assert.equal(grouped.length, 10);
  const all = grouped.flatMap(group => group.questions);
  assert.equal(all.length, 120);
  assert.equal(new Set(all.map(q => `${q.subject_id}:${q.question_number}`)).size, 120);
  for (const q of all) {
    const expected = golden.questions.find(row => row.subject_id === q.subject_id && row.question_number === q.question_number)!;
    assert.deepEqual([q.topic.name, q.correct_answer, q.selected_answer, q.solution_url], [expected.topic_label, expected.correct_answer, expected.selected_answer, expected.solution_url]);
  }
  for (const group of grouped) {
    const start = { tyt_geometry: 31, tyt_geography: 6, tyt_philosophy: 11, tyt_religion: 16, tyt_chemistry: 8, tyt_biology: 15 }[group.subject.id] ?? 1;
    assert.deepEqual(group.questions.map(q => q.question_number), Array.from({ length: group.questions.length }, (_, i) => start + i));
  }
  assert.equal(filterQuestions(all, "correct").length, golden.exam.total_correct);
  assert.equal(filterQuestions(all, "incorrect").length, golden.exam.total_wrong);
  assert.equal(filterQuestions(all, "blank").length, golden.exam.total_blank);
  assert.equal(filterQuestions(all, "cancelled").length, 0);
  // Reported averages and negative nets must survive grouping verbatim.
  for (const row of golden.subjects) assert.deepEqual(groupedResults.flatMap(group => group.rows).find(r => r.subject_id === row.subject_id && r.result_scope === row.result_scope), results([row])[0]);
});

test("cancelled questions remain distinct from blanks and retain scoring credit", async () => {
  const report = await fixtureReport("5ade3e51cd986a20854fff3770ec091034061db5.pdf");
  const all = questions(report.questions);
  const cancelled = filterQuestions(all, "cancelled");
  assert.deepEqual(cancelled.map(q => [q.question_number, q.selected_answer]), [[17, null], [25, null]]);
  assert.equal(filterQuestions(all, "correct").length + cancelled.length, report.exam.total_correct);
  assert.equal(filterQuestions(all, "blank").length, report.exam.total_blank);
  assert.equal(filterQuestions(all, "incorrect").length, report.exam.total_wrong);
  assert.equal(questionStatus({ correct_answer: "İPTAL", selected_answer: "A" }), "cancelled");
});

test("question rendering includes exactly 120 rows, canonical review labels and safe solution links", () => {
  const report = goldens[0];
  const all = questions(report.questions);
  all[0].topic = { name: "Kanonik <konu>…", needs_review: true };
  all[0].solution_url = "javascript:alert(1)";
  all[1].solution_url = null;
  all[2].solution_url = "https://example.test/solution";
  const html = renderToStaticMarkup(createElement(QuestionAnalysis, { groups: groupQuestions(results(report.subjects), all) }));
  assert.equal([...html.matchAll(/data-question="/g)].length, 120);
  assert.match(html, /Kanonik &lt;konu&gt;…/);
  assert.match(html, /Konu adı inceleme bekliyor/);
  assert.match(html, /Bağlantı yok/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /href="#questions-tyt_geometry"/);
  assert.equal(filterQuestions([], "blank").length, 0);
});

test("UUID validation rejects filter syntax and malformed identifiers", () => {
  assert.ok(isExamId("01234567-89ab-cdef-0123-456789abcdef"));
  for (const id of ["", "unknown", "01234567-89ab-cdef-0123-456789abcdef&select=*", "../dashboard"]) assert.equal(isExamId(id), false);
  assert.equal(questionStatus({ correct_answer: "B", selected_answer: "B" }), "correct");
  assert.equal(questionStatus({ correct_answer: "B", selected_answer: "A" }), "incorrect");
  assert.equal(questionStatus({ correct_answer: "B", selected_answer: null }), "blank");
});
