import type { DetailQuestion, DetailResult, ExamDetail } from "../src/lib/exam-detail";
import { studyBuckets, type StudyAnalysis, type StudyBucket, type StudyCounts, type StudyQuestion } from "../src/lib/topic-study-view";

export function studyReportFixture() {
  const buckets: StudyBucket[] = [...studyBuckets, "post_study", "post_study", "post_study", "post_study"];
  const questions: DetailQuestion[] = buckets.map((bucket, index) => ({
    id: `abcdef00-0000-0000-0000-${String(index).padStart(12, "0")}`,
    subject_id: index === 8 ? "tyt_biology" : "tyt_turkish", question_number: index + 1,
    correct_answer: bucket === "cancelled" ? "İPTAL" : "A",
    selected_answer: index === 7 ? null : index >= 6 ? "B" : "A",
    solution_url: index === 6 ? "https://example.test/solution.pdf#page=3" : null,
    topic: { name: `Özgün konu ${index + 1}`, needs_review: false },
  }));
  const studyQuestions: StudyQuestion[] = buckets.map((bucket, index) => ({
    id: questions[index].id, bucket,
    groupId: bucket === "unmapped" ? null : index === 9 ? "other-group" : "group-one",
    groupName: bucket === "unmapped" ? null : "Ortak grup adı",
    completedOn: bucket === "unmapped" || bucket === "missing_completion" ? null : bucket === "same_day" ? "2026-11-12" : bucket === "pre_study" ? "2026-11-14" : "2026-11-10",
  }));
  const counts = Object.fromEntries(studyBuckets.map(bucket => [bucket, buckets.filter(value => value === bucket).length])) as StudyCounts;
  const analysis: Extract<StudyAnalysis, { status: "available" }> = {
    status: "available", examId: "11111111-1111-1111-1111-111111111111", examDate: "2026-11-12", hasStudyRecords: true,
    counts, postStudy: { correct: 1, wrong: 3, blank: 1 }, questions: studyQuestions,
  };
  const results: DetailResult[] = (["tyt_biology", "tyt_turkish"] as const).map((id, index) => ({
    subject_id: id, result_scope: "direct", question_count: 0, correct_count: 0, wrong_count: 0, blank_count: 0, net: 0, average_net: null,
    subject: { id, name: index === 0 ? "Biyoloji" : "Türkçe", parent_id: null, display_order: index === 0 ? 10 : 1 },
  }));
  const exam: ExamDetail = {
    id: analysis.examId, name: "Deneme", exam_date: analysis.examDate, institution_name: null, class_label: null,
    score: null, total_questions: questions.length, total_correct: 6, total_wrong: 3, total_blank: 1, total_net: 5.25, average_net: null,
    exam_subject_results: results, exam_rankings: [], exam_questions: questions,
  };
  return { analysis, exam };
}

export function withoutEligible(analysis: Extract<StudyAnalysis, { status: "available" }>) {
  const changed = structuredClone(analysis);
  changed.counts.missing_completion += changed.counts.post_study;
  changed.counts.post_study = 0;
  changed.postStudy = { correct: 0, wrong: 0, blank: 0 };
  changed.questions = changed.questions!.map(question => question.bucket === "post_study" ? { ...question, bucket: "missing_completion", completedOn: null } : question);
  return changed;
}
