import Link from "next/link";
import type { ExamDetail } from "@/lib/exam-detail";
import { safePdfUrl } from "@/lib/pdf-url";
import { questionHref } from "@/lib/topic-stats";
import { buildStudyReport, studyBucketDisplayOrder, studyBucketLabels, studySectionId } from "@/lib/topic-study-report";
import { formatStudyDate, type StudyAnalysis } from "@/lib/topic-study-view";
import { StudyFirstUsePrompt, StudyUnavailable } from "../study-analysis-ui";

export function StudyAnalysisSection({ analysis, exam }: { analysis: StudyAnalysis | null; exam: ExamDetail }) {
  const { summary, subjects } = buildStudyReport(analysis, exam);
  return <section id={studySectionId} aria-labelledby="study-analysis-heading" className="mt-9 min-w-0 scroll-mt-6">
    <h2 id="study-analysis-heading" className="text-xl font-semibold">İşlediğim konularda kaçırdıklarım</h2>
    <div className="mt-4">
      {summary.state === "first_use" ? <StudyFirstUsePrompt /> : summary.state === "error" || summary.state === "unavailable" ?
        <StudyUnavailable state={summary.state} retryHref={`/yks27/tyt/${exam.id}#${studySectionId}`} /> : "analysis" in summary ? <>
          <p className="text-sm leading-6 tabular-nums"><strong>{summary.eligible.toLocaleString("tr-TR")} soru</strong>, konuların bitirildiği tarihten sonra soruldu · {summary.analysis.postStudy.correct.toLocaleString("tr-TR")} doğru · {summary.analysis.postStudy.wrong.toLocaleString("tr-TR")} yanlış · {summary.analysis.postStudy.blank.toLocaleString("tr-TR")} boş</p>
          {summary.state === "no_eligible" ? <p className="mt-2 text-sm leading-6 text-muted">Bu denemede işlendikten sonra sorulduğu belirlenebilen soru yok. Sonuç değerlendirilemiyor; aşağıdaki dağılım bunun nedenlerini gösterir.</p> :
            summary.state === "no_misses" ? <p className="mt-2 text-sm leading-6">Bu denemede, konuların bitirildiği tarihten sonra sorulan sorularda yanlış veya boş yok.</p> : null}
          <details className="mt-4 rounded-xl border border-border bg-surface">
            <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm">Tüm soruların dağılımı · {exam.total_questions.toLocaleString("tr-TR")} soru</summary>
            <dl className="grid gap-3 border-t border-border p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{studyBucketDisplayOrder.map(bucket => <div key={bucket} className="flex min-w-0 justify-between gap-3"><dt className="break-words text-muted">{studyBucketLabels[bucket]}</dt><dd className="shrink-0 font-medium tabular-nums">{summary.analysis.counts[bucket].toLocaleString("tr-TR")}</dd></div>)}</dl>
          </details>
          {subjects.length > 0 ? <div className="mt-5 flex flex-col gap-4">{subjects.map(({ subject, groups }) => <section key={subject.id} aria-labelledby={`study-subject-${subject.id}`} className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
            <header className="yks-band"><h3 id={`study-subject-${subject.id}`}>{subject.name}</h3></header>
            {groups.map(group => <div key={group.id} className="border-t border-border px-4 py-4 sm:px-6">
              <h4 className="break-words font-semibold">{group.name}</h4>
              <ul className="mt-2 divide-y divide-border">{group.misses.map(({ question, study, outcome }) => {
                const url = safePdfUrl(question.solution_url);
                return <li key={question.id} className="min-w-0 py-3">
                  <p className="break-words font-medium">{question.question_number.toLocaleString("tr-TR")}. soru · {question.topic.name}</p>
                  <p className="mt-1 text-sm"><span className={outcome === "incorrect" ? "font-medium text-incorrect" : "font-medium"}>{outcome === "incorrect" ? "Yanlış" : "Boş"}</span></p>
                  <p className="mt-1 text-sm leading-6 text-muted">Bitirdiğim tarih: <time dateTime={study.completedOn!}>{formatStudyDate(study.completedOn!)}</time><span className="block sm:inline"> · Deneme tarihi: <time dateTime={exam.exam_date}>{formatStudyDate(exam.exam_date)}</time></span></p>
                  <div className="mt-1 flex flex-wrap gap-x-5 text-sm">
                    <Link href={questionHref(exam.id, question.subject_id, question.question_number)} aria-label={`${subject.name} ${question.question_number}. soruya git`} className="inline-flex min-h-11 items-center text-accent hover:underline">Soruya git</Link>
                    {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${subject.name} ${question.question_number}. soru: Çözümü aç (yeni sekme)`} className="inline-flex min-h-11 items-center text-accent hover:underline">Çözümü aç (yeni sekme)</a> : <span className="inline-flex min-h-11 items-center text-muted">Çözüm bağlantısı yok</span>}
                  </div>
                </li>;
              })}</ul>
            </div>)}
          </section>)}</div> : null}
        </> : null}
    </div>
  </section>;
}
