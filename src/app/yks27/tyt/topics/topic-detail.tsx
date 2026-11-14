import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { safePdfUrl } from "@/lib/pdf-url";
import { questionHref } from "@/lib/topic-stats";
import type { BreakdownQuestion, TopicBreakdown } from "@/lib/topic-view";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceEmpty } from "../../workspace-ui";
import { dateLabel, formatPercent, number } from "../data";

function outcomeLabel(question: BreakdownQuestion) {
  if (question.correctAnswer === "İPTAL") return "İptal · Doğru sayıldı";
  if (!question.selectedAnswer) return "Boş";
  return question.selectedAnswer === question.correctAnswer ? "Doğru" : "Yanlış";
}
export function TopicDetail({ breakdown, subjectName, closeHref }: { breakdown: TopicBreakdown; subjectName: string; closeHref: string }) {
  const topic = breakdown.topic;
  if (!topic) return <div id="konu-detayi" className="my-6"><WorkspaceEmpty title="Konu bulunamadı" href={closeHref} action="Konu listesine dön">Seçilen konu bu hesapta yok. Listeden başka bir konu aç.</WorkspaceEmpty></div>;
  const observed = breakdown.exams.filter(exam => exam.metrics.valid > 0);
  const first = observed[0], last = observed.at(-1);
  const delta = first && last && first !== last && first.metrics.success !== null && last.metrics.success !== null ? (last.metrics.success - first.metrics.success) * 100 : null;
  return <Card id="konu-detayi" className="yks-drilldown"><CardHeader><CardTitle><h2>{topic.name}</h2></CardTitle><CardDescription>{subjectName}{topic.groupName ? ` · ${topic.groupName}` : " · Grupsuz konu"}</CardDescription><Button asChild variant="link" className="justify-self-start"><Link href={closeHref} scroll={false}>Konu detayını kapat</Link></Button></CardHeader><CardContent>
    {topic.needsReview ? <p className="mb-3 text-muted">Konu adı inceleme bekliyor. Başarı, yazılı etiket üzerinden hesaplanır.</p> : null}
    <p className="mb-4 text-sm text-muted">{observed.length < 2 ? "Eğilim için bu aralıkta en az iki deneme gerekir. Tek gözlem güçlü veya zayıf performans sayılmaz." : `İlk denemeden son denemeye başarı farkı: ${number(delta, 2, true)} yüzde puan.`}</p>
    {!breakdown.exams.length ? <p>Seçilen aralıkta bu konudan soru yok.</p> : breakdown.exams.map(exam => <article key={exam.id} className="yks-drilldown-exam"><h3 className="font-semibold"><Link href={`/yks27/tyt/${exam.id}`} className="hover:text-accent hover:underline">{exam.name}</Link></h3><p className="mt-1 text-xs text-muted"><time dateTime={exam.examDate}>{dateLabel(exam.examDate)}</time></p><p className="mt-2 text-sm leading-6 text-muted">{exam.metrics.valid} geçerli soru · {exam.metrics.correct} doğru · {exam.metrics.wrong} yanlış · {exam.metrics.blank} boş · Başarı {exam.metrics.success === null ? "Soru yok" : formatPercent(exam.metrics.success)} · Net {number(exam.metrics.net)}{exam.metrics.cancelled ? ` · ${exam.metrics.cancelled} iptal soru başarıya katılmaz` : ""}</p><ul className="mt-3 flex flex-wrap gap-2">{exam.questions.map(question => {
      const solution = safePdfUrl(question.solutionUrl);
      return <li key={question.questionNumber} className="yks-question-chip"><Link href={questionHref(exam.id, question.subjectId, question.questionNumber)} prefetch={false}>Soru {question.questionNumber}</Link><Badge variant="outline" className="ml-2">{outcomeLabel(question)}</Badge><span className="block text-muted">Anahtar {question.correctAnswer} · Cevap {question.selectedAnswer ?? "—"}</span>{solution ? <a href={solution} target="_blank" rel="noopener noreferrer">Çözümü aç<ExternalLink size={14} aria-hidden="true" className="ml-1" /></a> : null}</li>;
    })}</ul></article>)}
  </CardContent></Card>;
}
