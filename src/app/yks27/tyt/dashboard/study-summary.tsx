import Link from "next/link";
import { buildStudyDashboardSummary } from "@/lib/topic-study-summary";
import type { StudyAnalysis } from "@/lib/topic-study-view";
import { StudyFirstUsePrompt, StudyUnavailable } from "../study-analysis-ui";

export function StudyDashboardSummary({ analysis, examId }: { analysis: StudyAnalysis | null; examId: string }) {
  const { summary, href, message, notes } = buildStudyDashboardSummary(analysis, examId);
  return <aside aria-label="Son denemede işlenen konu özeti" className="mb-5 min-w-0 text-sm leading-6">
    {summary.state === "first_use" ? <StudyFirstUsePrompt /> : summary.state === "error" || summary.state === "unavailable" ?
      <StudyUnavailable state={summary.state} retryHref={href} /> : <>
        <p><Link href={href} className="inline-flex min-h-11 max-w-full items-center break-words text-accent hover:underline">{message}<span className="sr-only"> · Son denemenin işlenen konu analizini incele</span></Link></p>
        {notes.length > 0 ? <p className="text-xs text-muted">{notes.join(" · ")}</p> : null}
      </>}
  </aside>;
}
