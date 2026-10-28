import type { Answer, ExamInfo, Ranking, SubjectResult } from "./exam-import/types";

export type DetailSubject = { id: string; name: string; parent_id: string | null; display_order: number };
export type DetailResult = SubjectResult & { subject: DetailSubject };
export type DetailQuestion = {
  id: string; subject_id: string; question_number: number;
  correct_answer: Answer | "İPTAL"; selected_answer: Answer | null;
  solution_url: string | null; topic: { name: string; needs_review: boolean };
};
export type ExamDetail = Pick<ExamInfo, "name" | "exam_date" | "institution_name" | "class_label" | "score" | "total_questions" | "total_correct" | "total_wrong" | "total_blank" | "total_net" | "average_net"> & {
  id: string; exam_subject_results: DetailResult[]; exam_rankings: Ranking[]; exam_questions: DetailQuestion[];
};
export const rankingLabels = { general: "Genel", institution: "Kurum", branch: "Şube", class: "Sınıf" } as const;
export const statusLabels = { all: "Tümü", correct: "Doğru", incorrect: "Yanlış", blank: "Boş", cancelled: "İptal" } as const;
export type QuestionFilter = keyof typeof statusLabels;

export function questionStatus(question: Pick<DetailQuestion, "correct_answer" | "selected_answer">): Exclude<QuestionFilter, "all"> {
  if (question.correct_answer === "İPTAL") return "cancelled";
  if (question.selected_answer === null) return "blank";
  return question.correct_answer === question.selected_answer ? "correct" : "incorrect";
}
export function filterQuestions(questions: DetailQuestion[], filter: QuestionFilter) {
  return filter === "all" ? questions : questions.filter(question => questionStatus(question) === filter);
}
export function groupResults(results: DetailResult[]) {
  return ["tyt_turkish", "tyt_social", "tyt_math", "tyt_science"].map(id => {
    const rows = results.filter(row => row.subject_id === id || row.subject.parent_id === id)
      .sort((a, b) => Number(a.result_scope === "aggregate") - Number(b.result_scope === "aggregate") || a.subject.display_order - b.subject.display_order);
    return { id, name: rows.find(row => row.subject_id === id)?.subject.name ?? "Veri yok", rows };
  });
}
export function groupQuestions(results: DetailResult[], questions: DetailQuestion[]) {
  return results.filter(result => result.result_scope === "direct")
    .sort((a, b) => a.subject.display_order - b.subject.display_order)
    .map(result => ({ subject: result.subject, questions: questions.filter(q => q.subject_id === result.subject_id).sort((a, b) => a.question_number - b.question_number) }));
}

export function isExamId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
