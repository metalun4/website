import { selectStudySummary, studyBucketLabels, studySectionId, type StudySummary } from "./topic-study-report";
import type { StudyAnalysis } from "./topic-study-view";

export function buildStudyDashboardSummary(analysis: StudyAnalysis | null, examId: string) {
  const summary: StudySummary = analysis && analysis.examId.toLowerCase() !== examId.toLowerCase()
    ? { state: "unavailable" } : selectStudySummary(analysis);
  const href = `/yks27/tyt/${examId}#${studySectionId}`;
  if (!("analysis" in summary)) return { summary, href, message: null, notes: [] as string[] };
  const message = summary.state === "no_eligible"
    ? "Bu denemede işlendikten sonra sorulduğu belirlenebilen soru yok; sonuç değerlendirilemiyor."
    : `İşlenen konulardaki ${summary.eligible.toLocaleString("tr-TR")} soruda ${summary.misses.toLocaleString("tr-TR")} yanlış veya boş`;
  const notes = (["same_day", "missing_completion", "unmapped"] as const)
    .filter(bucket => summary.analysis.counts[bucket] > 0)
    .map(bucket => `${studyBucketLabels[bucket]}: ${summary.analysis.counts[bucket].toLocaleString("tr-TR")} soru`);
  return { summary, href, message, notes };
}
