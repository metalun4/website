export type Answer = "A" | "B" | "C" | "D" | "E";
export type SubjectId = typeof SUBJECTS[number]["id"];
export const SUBJECTS = [
  { id: "tyt_turkish", name: "Türkçe", parent: null, count: 40 },
  { id: "tyt_social", name: "Sosyal Bilimler", parent: null, count: 0 },
  { id: "tyt_history", name: "Tarih", parent: "tyt_social", count: 5 },
  { id: "tyt_geography", name: "Coğrafya", parent: "tyt_social", count: 5 },
  { id: "tyt_philosophy", name: "Felsefe", parent: "tyt_social", count: 5 },
  { id: "tyt_religion", name: "Din Kültürü", parent: "tyt_social", count: 5 },
  { id: "tyt_math", name: "Matematik", parent: null, count: 30 },
  { id: "tyt_geometry", name: "Geometri", parent: "tyt_math", count: 10 },
  { id: "tyt_science", name: "Fen Bilimleri", parent: null, count: 0 },
  { id: "tyt_physics", name: "Fizik", parent: "tyt_science", count: 7 },
  { id: "tyt_chemistry", name: "Kimya", parent: "tyt_science", count: 7 },
  { id: "tyt_biology", name: "Biyoloji", parent: "tyt_science", count: 6 },
] as const;
export type Counts = { question_count: number; correct_count: number; wrong_count: number; blank_count: number; net: number; average_net: number | null };
export type SubjectResult = Counts & { subject_id: SubjectId; result_scope: "direct" | "aggregate" };
export type Ranking = { scope: "general" | "institution" | "branch" | "class"; rank: number; participant_count: number };
// İPTAL preserves the printed cancellation marker; it is not an answer key.
export type ParsedQuestion = { question_number: number; subject_id: SubjectId; topic_label: string; correct_answer: Answer | "İPTAL"; selected_answer: Answer | null; solution_url: string | null };
export type ExamInfo = { exam_type: "TYT"; name: string; exam_date: string; institution_name: string | null; class_label: string | null; score: number | null; total_questions: number; total_correct: number; total_wrong: number; total_blank: number; total_net: number; average_net: number | null; report_generated_at: string | null; source_pdf_path: null };
export type ParsedExam = { exam: ExamInfo; subjects: SubjectResult[]; rankings: Ranking[]; questions: ParsedQuestion[]; warnings: string[] };
export type TextBox = { text: string; x: number; y: number; width: number; height: number };
export type LinkBox = { x: number; y: number; width: number; height: number; url: string };
export type ExtractedPage = { width: number; height: number; text: TextBox[]; links: LinkBox[] };
export type ExtractedPdf = { pages: ExtractedPage[]; repairedGlyphs: boolean };
export class ImportError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "ImportError"; }
}
export type Topic = { id: string; subject_id: string; name: string; normalized_name: string; needs_review: boolean };
export type ImportResult = { status: "imported" | "duplicate" | "collision"; exam_id: string | null; review_topics: Topic[]; unassigned_topics?: Topic[] };
export type Preview = Omit<ParsedExam, "questions"> & { questionCount: number; linkCount: number; reviewTopics: string[]; unassignedLabels: string[]; receipt: string; duplicate: boolean; collision: boolean };
