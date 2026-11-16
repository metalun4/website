import { questionStatus, type DetailQuestion, type DetailSubject, type ExamDetail } from "./exam-detail";
import { studyBuckets, type StudyAnalysis, type StudyBucket, type StudyQuestion } from "./topic-study-view";

export const studySectionId = "islenen-konularda-kacirilanlar";
export const studyBucketLabels: Record<StudyBucket, string> = {
  post_study: "İşlendikten sonra sorulan",
  pre_study: "Deneme tarihinde henüz işlenmemişti",
  same_day: "Aynı gün · sırası belirtilmedi",
  missing_completion: "İşlenme bilgisi eksik",
  unmapped: "Konu eşlemesi belirsiz",
  cancelled: "İptal",
};
export const studyBucketDisplayOrder = ["post_study", "pre_study", "same_day", "missing_completion", "unmapped", "cancelled"] as const;

type AvailableAnalysis = Extract<StudyAnalysis, { status: "available" }>;
export type StudySummary =
  | { state: "error" | "unavailable" | "first_use" }
  | { state: "no_eligible" | "no_misses" | "misses"; analysis: AvailableAnalysis; eligible: number; misses: number };

/** Null means a failed request, never an empty successful analysis. */
export function selectStudySummary(analysis: StudyAnalysis | null): StudySummary {
  if (!analysis) return { state: "error" };
  if (analysis.status === "unavailable") return { state: "unavailable" };
  if (!analysis.hasStudyRecords) return { state: "first_use" };
  const eligible = analysis.counts.post_study;
  const misses = analysis.postStudy.wrong + analysis.postStudy.blank;
  return { state: eligible === 0 ? "no_eligible" : misses === 0 ? "no_misses" : "misses", analysis, eligible, misses };
}

export type StudyMiss = { question: DetailQuestion; study: StudyQuestion; outcome: "incorrect" | "blank" };
export type StudyMissSubject = { subject: DetailSubject; groups: { id: string; name: string; misses: StudyMiss[] }[] };
type ReportExam = Pick<ExamDetail, "id" | "exam_date" | "total_questions" | "exam_questions" | "exam_subject_results">;
export type StudyJoinIssue = {
  reason: "question_ids" | "counts" | "exam" | "subjects" | "outcomes";
  missingFromQuestions: string[];
  missingFromAnalysis: string[];
};
export type StudyReport = { summary: StudySummary; subjects: StudyMissSubject[]; issue?: StudyJoinIssue };

/** Buckets come exclusively from SQL; outcomes come exclusively from the loaded questions. */
export function buildStudyReport(analysis: StudyAnalysis | null, exam: ReportExam): StudyReport {
  const summary = selectStudySummary(analysis);
  if (!analysis || analysis.status === "unavailable") return { summary, subjects: [] };
  const questions = new Map(exam.exam_questions.map(question => [question.id.toLowerCase(), question]));
  const studyQuestions = new Map((analysis.questions ?? []).map(question => [question.id.toLowerCase(), question]));
  const missingFromQuestions = [...studyQuestions.keys()].filter(id => !questions.has(id));
  const missingFromAnalysis = [...questions.keys()].filter(id => !studyQuestions.has(id));
  const unavailable = (reason: StudyJoinIssue["reason"]): StudyReport => ({
    summary: { state: "unavailable" }, subjects: [], issue: { reason, missingFromQuestions, missingFromAnalysis },
  });
  if (analysis.examId.toLowerCase() !== exam.id.toLowerCase() || analysis.examDate !== exam.exam_date) return unavailable("exam");
  if (!analysis.questions || missingFromQuestions.length || missingFromAnalysis.length ||
    questions.size !== exam.exam_questions.length || studyQuestions.size !== analysis.questions.length) return unavailable("question_ids");
  const total = studyBuckets.reduce((sum, bucket) => sum + analysis.counts[bucket], 0);
  if (total !== exam.total_questions || questions.size !== total ||
    studyBuckets.some(bucket => analysis.questions!.filter(question => question.bucket === bucket).length !== analysis.counts[bucket])) return unavailable("counts");

  const subjects = new Map(exam.exam_subject_results.map(result => [result.subject.id, result.subject]));
  const grouped = new Map<string, StudyMissSubject>();
  const outcomes = { correct: 0, wrong: 0, blank: 0 };
  for (const study of studyQuestions.values()) {
    const question = questions.get(study.id.toLowerCase())!;
    const subject = subjects.get(question.subject_id);
    if (!subject) return unavailable("subjects");
    if (study.bucket !== "post_study") continue;
    const outcome = questionStatus(question);
    if (outcome === "cancelled") return unavailable("outcomes");
    outcomes[outcome === "incorrect" ? "wrong" : outcome]++;
    if (outcome === "correct") continue;
    // The parser requires these fields for post-study questions. Keep the join defensive too.
    if (!study.groupId || !study.groupName || !study.completedOn) return unavailable("counts");
    let subjectGroup = grouped.get(subject.id);
    if (!subjectGroup) {
      subjectGroup = { subject, groups: [] };
      grouped.set(subject.id, subjectGroup);
    }
    let group = subjectGroup.groups.find(item => item.id === study.groupId);
    if (!group) {
      group = { id: study.groupId, name: study.groupName, misses: [] };
      subjectGroup.groups.push(group);
    }
    group.misses.push({ question, study, outcome });
  }
  if (outcomes.correct !== analysis.postStudy.correct || outcomes.wrong !== analysis.postStudy.wrong || outcomes.blank !== analysis.postStudy.blank) return unavailable("outcomes");
  const ordered = [...grouped.values()].sort((a, b) => a.subject.display_order - b.subject.display_order || a.subject.id.localeCompare(b.subject.id));
  for (const subject of ordered) {
    subject.groups.sort((a, b) => a.name.localeCompare(b.name, "tr") || a.id.localeCompare(b.id));
    for (const group of subject.groups) group.misses.sort((a, b) => a.question.question_number - b.question.question_number);
  }
  return { summary, subjects: ordered };
}
