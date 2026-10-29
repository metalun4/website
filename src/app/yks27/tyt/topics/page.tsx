import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/session";
import { loadTopicAnalysis, loadTopicBreakdown } from "@/lib/topic-analysis";
import { safePdfUrl } from "@/lib/pdf-url";
import { SUBJECTS } from "@/lib/exam-import/types";
import { buildTopicView, topicSubjectAllowed, type BreakdownQuestion, type TopicBreakdown, type VisibleTopic } from "@/lib/topic-view";
import {
  MISS_RATE, MIN_EXAMS, MIN_VALID_QUESTIONS, STRONG_RATE,
  isUuid, questionHref, readingLabels, topicQuery, topicRange, topicSort,
  type PerformanceReading, type TopicMetrics, type TopicSort,
} from "@/lib/topic-stats";
import { queryValue, type Query } from "@/lib/yks-navigation";
import { AccountBar } from "../account-bar";
import { dateLabel, formatPercent, number } from "../data";

export const metadata: Metadata = {
  title: "Konu Başarı Analizi | YKS 2027",
  description: "TYT denemelerinde konu gruplarına göre doğru, yanlış, boş ve net dağılımı.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const wholePercent = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const ranges = [{ value: "5", label: "Son 5" }, { value: "10", label: "Son 10" }, { value: "all", label: "Tümü" }] as const;
const sorts: { value: TopicSort; label: string }[] = [
  { value: "performance", label: "Başarı" },
  { value: "questions", label: "Soru sayısı" },
  { value: "name", label: "Ada göre" },
];
const subjectChoices = SUBJECTS.filter(subject => subject.count > 0);

function rateLabel(value: number | null) {
  return value === null ? "Veri yok" : formatPercent(value);
}
function readingClass(reading: PerformanceReading) {
  if (reading === "strong") return "font-medium text-accent";
  if (reading === "wrong") return "font-medium text-red-700 dark:text-red-400";
  return "text-muted";
}
function outcomeLabel(question: BreakdownQuestion) {
  if (question.correctAnswer === "İPTAL") return "İptal · Doğru sayıldı";
  if (!question.selectedAnswer) return "Boş";
  return question.selectedAnswer === question.correctAnswer ? "Doğru" : "Yanlış";
}

function MetricText({ metrics }: { metrics: TopicMetrics }) {
  return <p className="mt-2 text-sm leading-6 text-muted tabular-nums">
    <span className="text-foreground">{number(metrics.valid, 0)} geçerli soru</span>
    {" · "}{number(metrics.correct, 0)} doğru
    {" · "}{number(metrics.wrong, 0)} yanlış
    {" · "}{number(metrics.blank, 0)} boş
    {" · "}Başarı {rateLabel(metrics.success)}
    {" · "}Deneme oranı {rateLabel(metrics.attempt)}
    {" · "}Denenenlerde doğruluk {rateLabel(metrics.accuracy)}
    {" · "}Net {number(metrics.net)}
    {" · "}{number(metrics.exams, 0)} deneme
    {metrics.cancelled > 0 ? ` · ${number(metrics.cancelled, 0)} iptal soru başarıya katılmaz` : ""}
  </p>;
}

function PerformanceBar({ name, metrics }: { name: string; metrics: TopicMetrics }) {
  if (metrics.success === null) return <p className="mt-3 text-sm text-muted">Bu aralıkta geçerli soru yok.</p>;
  return <meter className="yks-meter mt-3" min={0} max={100} value={metrics.success * 100} aria-label={`${name} başarı yüzdesi: ${rateLabel(metrics.success)}`} />;
}

function TopicLink({ topic, href }: { topic: VisibleTopic; href: string }) {
  return <article className="min-w-0 border-t border-border px-4 py-4">
    <p className="break-words font-medium"><Link href={href} className="hover:text-accent hover:underline">{topic.name}</Link></p>
    {topic.needsReview ? <p className="mt-1 text-xs text-muted">Konu adı inceleme bekliyor.</p> : null}
    <p className={`mt-1 text-sm ${readingClass(topic.reading)}`}>{readingLabels[topic.reading]}</p>
    <MetricText metrics={topic.metrics} />
  </article>;
}

function Filters({ range, subject, q, sort, topic, group }: { range: string; subject: string; q: string; sort: TopicSort; topic: string; group: string }) {
  const href = (patch: { range?: string; subject?: string; sort?: TopicSort }) => `/yks27/tyt/topics${topicQuery({ range, subject, q, sort, topic, group, ...patch })}`;
  return <section aria-label="Konu analizi filtreleri" className="mb-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-medium">Deneme aralığı</h2>
      <nav aria-label="Deneme aralığı" className="flex flex-wrap gap-2">
        {ranges.map(item => <Link key={item.value} href={href({ range: item.value })} scroll={false} aria-current={range === item.value ? "true" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm ${range === item.value ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border hover:bg-surface-muted"}`}>{item.label}</Link>)}
      </nav>
    </div>
    <form action="/yks27/tyt/topics" className="yks-panel grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] sm:items-end">
      {range !== "all" ? <input type="hidden" name="range" value={range} /> : null}
      {sort !== "performance" ? <input type="hidden" name="sort" value={sort} /> : null}
      {topic ? <input type="hidden" name="topic" value={topic} /> : null}
      {group ? <input type="hidden" name="group" value={group} /> : null}
      <label className="block min-w-0">Ders
        <select name="subject" defaultValue={subject} className="yks-input mt-1">
          <option value="">Tüm dersler</option>
          {subjectChoices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="block min-w-0">Grup veya konu ara
        <input type="search" name="q" defaultValue={q} maxLength={100} autoComplete="off" placeholder="Örn. paragraf…" className="yks-input mt-1" />
      </label>
      <button className="yks-button">Filtrele</button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-medium">Sıralama</h2>
      <nav aria-label="Sıralama" className="flex flex-wrap gap-2">
        {sorts.map(item => <Link key={item.value} href={href({ sort: item.value })} scroll={false} aria-current={sort === item.value ? "true" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm ${sort === item.value ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border hover:bg-surface-muted"}`}>{item.label}</Link>)}
      </nav>
    </div>
  </section>;
}

function RankList({ title, topics, hrefFor }: { title: string; topics: VisibleTopic[]; hrefFor: (topic: VisibleTopic) => string }) {
  return <section className="yks-panel min-w-0">
    <h3 className="font-semibold">{title}</h3>
    {topics.length === 0 ? <p className="mt-2 text-sm text-muted">Bu aralıkta listelenecek konu yok.</p> : <ol className="mt-3 space-y-3">
      {topics.map(topic => <li key={topic.id} className="min-w-0">
        <Link href={hrefFor(topic)} className="break-words font-medium hover:text-accent hover:underline">{topic.name}</Link>
        <p className="text-sm text-muted tabular-nums">{number(topic.metrics.wrong, 0)} yanlış · {number(topic.metrics.blank, 0)} boş · başarı {rateLabel(topic.metrics.success)} · {readingLabels[topic.reading]}</p>
      </li>)}
    </ol>}
  </section>;
}

function Detail({ breakdown, subjectName }: { breakdown: TopicBreakdown; subjectName: string }) {
  const topic = breakdown.topic;
  if (!topic) return <section id="konu-detayi" className="yks-panel mb-6 scroll-mt-6"><h2 className="text-xl font-semibold">Konu bulunamadı</h2><p className="mt-2 text-muted">Seçilen konu bu hesapta yok. Listeden başka bir konu aç.</p></section>;
  const observed = breakdown.exams.filter(exam => exam.metrics.valid > 0);
  const first = observed[0];
  const last = observed.at(-1);
  const delta = first && last && first !== last && first.metrics.success !== null && last.metrics.success !== null ? (last.metrics.success - first.metrics.success) * 100 : null;
  return <section id="konu-detayi" aria-labelledby="detail-heading" className="mb-6 scroll-mt-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
    <p className="text-sm text-muted">{subjectName}{topic.groupName ? ` · ${topic.groupName}` : " · Grupsuz konu"}</p>
    <h2 id="detail-heading" className="mt-1 break-words text-2xl font-semibold">{topic.name}</h2>
    {topic.needsReview ? <p className="mt-2 text-sm text-muted">Konu adı inceleme bekliyor. Başarı, yazılı etiket üzerinden hesaplanır.</p> : null}
    {observed.length < 2 ? <p className="mt-3 text-sm text-muted">Eğilim için bu aralıkta en az iki deneme gerekir. Tek gözlem güçlü veya zayıf performans sayılmaz.</p> : <p className="mt-3 text-sm tabular-nums">İlk denemeden son denemeye başarı farkı: {number(delta, 2, true)} yüzde puan.</p>}
    {breakdown.exams.length === 0 ? <p className="mt-4 text-muted">Seçilen aralıkta bu konudan soru yok.</p> : <div className="mt-4 space-y-4">
      {breakdown.exams.map(exam => <article key={exam.id} className="rounded-lg border border-border p-4">
        <h3 className="break-words font-semibold"><Link href={`/yks27/tyt/${exam.id}`} className="hover:text-accent hover:underline">{exam.name}</Link></h3>
        <p className="mt-1 text-sm text-muted"><time dateTime={exam.examDate}>{dateLabel(exam.examDate)}</time></p>
        <MetricText metrics={exam.metrics} />
        <ul className="mt-3 flex flex-wrap gap-2">
          {exam.questions.map(question => {
            const solution = safePdfUrl(question.solutionUrl);
            return <li key={question.questionNumber} className="min-w-0 rounded-lg border border-border px-3 py-2 text-sm">
              <Link href={questionHref(exam.id, question.subjectId, question.questionNumber)} prefetch={false} className="font-medium hover:text-accent hover:underline">Soru {question.questionNumber}</Link>
              <span className="mt-1 block text-muted">{outcomeLabel(question)} · Anahtar {question.correctAnswer} · Cevap {question.selectedAnswer ?? "—"}</span>
              {solution ? <a href={solution} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-accent hover:underline">Çözümü aç<ExternalLink size={14} aria-hidden="true" /></a> : null}
            </li>;
          })}
        </ul>
      </article>)}
    </div>}
  </section>;
}

export default async function TopicAnalysisPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const range = topicRange(queryValue(query.range));
  const sort = topicSort(queryValue(query.sort));
  const requestedSubject = queryValue(query.subject);
  const subject = topicSubjectAllowed(requestedSubject) ? requestedSubject : "";
  const q = queryValue(query.q).trim().slice(0, 100);
  const topicId = isUuid(queryValue(query.topic)) ? queryValue(query.topic) : "";
  const groupId = isUuid(queryValue(query.group)) ? queryValue(query.group) : "";
  const currentQuery = { range, subject, q, sort, topic: topicId, group: groupId };
  const session = await requireSession(`/yks27/tyt/topics${topicQuery(currentQuery)}`);
  const [analysis, breakdown] = await Promise.all([
    loadTopicAnalysis(range),
    topicId ? loadTopicBreakdown(topicId, range) : Promise.resolve(null),
  ]);
  const view = buildTopicView(analysis, { subjectId: subject, query: q, sort });
  const admin = session.role === "admin";
  const topicHrefFor = (topic: VisibleTopic) => `/yks27/tyt/topics${topicQuery({ range, subject, q, sort, topic: topic.id })}#konu-detayi`;
  const subjectName = analysis.subjects.find(item => item.id === breakdown?.topic?.subjectId)?.name ?? "Ders";
  const clearHref = "/yks27/tyt/topics";
  return <main className="yks-page"><div className="mx-auto max-w-7xl">
    <AccountBar admin={admin} />
    <header className="mb-5">
      <nav aria-label="İçerik yolu" className="mb-3"><ol className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <li><Link href="/yks27/tyt" className="inline-flex items-center hover:text-accent">TYT denemeleri</Link></li>
        <li aria-hidden="true">/</li>
        <li><Link href="/yks27/tyt/dashboard" className="inline-flex items-center hover:text-accent">Gelişim paneli</Link></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">Konu başarısı</li>
      </ol></nav>
      <h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">Konu Başarı Analizi</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Aynı müfredat grubunun denemeler boyunca doğru, yanlış ve boş dağılımı. Tek sınavın soru dökümü deneme raporunda kalır.</p>
    </header>
    {analysis.examTotal === 0 ? <section className="yks-panel"><h2 className="text-lg font-semibold">Henüz deneme kaydı yok</h2><p className="mt-2 text-muted">İlk deneme eklendiğinde konu grupları burada dolacak. Boş gruplar düşük başarı sayılmaz.</p>{admin ? <Link href="/yks27/admin" className="yks-button mt-4">İlk denemeyi ekle</Link> : null}</section> : <>
      <Filters range={range} subject={subject} q={q} sort={sort} topic={topicId} group={groupId} />
      {(subject || q || range !== "all" || sort !== "performance") ? <p className="mb-4"><Link href={clearHref} className="text-accent hover:underline">Filtreleri temizle</Link></p> : null}
      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4" aria-label="Seçilen aralığın özeti">
        {[
          ["Geçerli soru", number(view.overall.valid, 0)],
          ["Deneme", `${number(analysis.exams.length, 0)} / ${number(analysis.examTotal, 0)}`],
          ["Soru görülen grup", number(view.encounteredGroups, 0)],
          ["Başarı", rateLabel(view.overall.success)],
        ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-border bg-surface p-3 sm:p-5"><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</dd></div>)}
      </dl>
      <section className="mb-6 rounded-lg bg-surface-muted p-4 text-sm leading-6">
        <h2 className="font-semibold">Bu sayılar neyi ölçer?</h2>
        <p className="mt-2">Başarı = doğru / geçerli soru. Deneme oranı = cevaplanan / geçerli soru. Denenenlerde doğruluk = doğru / cevaplanan soru. Net = doğru − yanlış / 4. Boşlar başarıyı düşürür; doğruluğu ise yalnızca denenen sorulardan hesaplanır.</p>
        <p className="mt-2">Güçlü performans için en az {MIN_EXAMS} deneme, {MIN_VALID_QUESTIONS} geçerli soru ve {wholePercent.format(STRONG_RATE)} başarı ile denenen doğruluk gerekir. Yanlışlar, yanlış payı {wholePercent.format(MISS_RATE)} veya üzeri ve boşlardan az değilse öne çıkar. Boşlar, boş payı bu eşiği geçip yanlışlardan fazlaysa öne çıkar. Daha az gözlem yorumlanmaz.</p>
        <p className="mt-2 tabular-nums">Bu özette {number(view.overall.valid + view.overall.cancelled, 0)} soru var. {number(view.grouped.valid + view.grouped.cancelled, 0)} soru bir gruba bağlı. {number(view.unassignedAll.reduce((sum, topic) => sum + topic.counts.valid + topic.counts.cancelled, 0), 0)} soru grupsuz ve özete bir kez dahil. {view.overall.cancelled > 0 ? `${number(view.overall.cancelled, 0)} iptal soru resmi nette doğru sayılır, konu başarısına katılmaz.` : "İptal soru yok."}</p>
      </section>
      {breakdown ? <Detail breakdown={breakdown} subjectName={subjectName} /> : null}
      <section aria-labelledby="priority-heading" className="mb-6">
        <h2 id="priority-heading" className="mb-3 text-lg font-semibold">Öne çıkan konular</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <RankList title="En çok yanlış" topics={view.topWrong} hrefFor={topicHrefFor} />
          <RankList title="En çok boş" topics={view.topBlank} hrefFor={topicHrefFor} />
          <RankList title="Güçlü performans" topics={view.topStrong} hrefFor={topicHrefFor} />
        </div>
      </section>
      <nav aria-label="Derslere git" className="yks-jump-links mb-5">{view.sections.map(section => <a key={section.id} href={`#ders-${section.id}`}>{section.name}</a>)}<a href="#gruplanmamis">Grupsuz konular</a></nav>
      {view.sections.map(section => <section key={section.id} id={`ders-${section.id}`} aria-labelledby={`heading-${section.id}`} className="mb-8 scroll-mt-6">
        <h2 id={`heading-${section.id}`} className="text-xl font-semibold">{section.name}</h2>
        {section.subjects.map(subjectRow => <div key={subjectRow.id} className="mt-4">
          {section.subjects.length > 1 ? <h3 className="mb-3 font-semibold">{subjectRow.name}</h3> : null}
          <p className="mb-3 text-sm text-muted tabular-nums">Ders toplamı: {number(subjectRow.metrics.valid, 0)} geçerli soru · başarı {rateLabel(subjectRow.metrics.success)} · net {number(subjectRow.metrics.net)}{subjectRow.unassignedQuestions > 0 ? ` · ${number(subjectRow.unassignedQuestions, 0)} grupsuz soru aşağıdaki bölümde` : ""}</p>
          {subjectRow.groups.length === 0 ? <p className="text-sm text-muted">Bu aramada görünen grup yok.</p> : <div className="space-y-3">{subjectRow.groups.map(group => <details key={group.id} id={`grup-${group.id}`} open={Boolean(q) || group.id === groupId} className="yks-topic-card scroll-mt-6 rounded-xl border border-border bg-surface">
            <summary className="min-h-11 cursor-pointer px-4 py-4 hover:bg-surface-muted">
              <span className="block min-w-0 break-words font-semibold">{group.name}</span>
              <span className={`mt-1 block text-sm ${readingClass(group.reading)}`}>{readingLabels[group.reading]}</span>
            </summary>
            <div className="border-t border-border px-4 pb-4">
              <MetricText metrics={group.metrics} />
              <PerformanceBar name={group.name} metrics={group.metrics} />
              {group.metrics.valid === 0 ? <p className="mt-3 text-sm text-muted">Bu grupta seçilen aralıkta soru yok. Bu, düşük başarı değildir.</p> : null}
              {group.topics.length === 0 ? null : <div className="-mx-4 mt-3">{group.topics.map(topic => <TopicLink key={topic.id} topic={topic} href={`/yks27/tyt/topics${topicQuery({ range, subject, q, sort, topic: topic.id, group: group.id })}#konu-detayi`} />)}</div>}
            </div>
          </details>)}</div>}
        </div>)}
      </section>)}
      <section id="gruplanmamis" aria-labelledby="unassigned-heading" className="scroll-mt-6 rounded-xl border border-border bg-surface">
        <header className="px-4 py-4">
          <h2 id="unassigned-heading" className="text-xl font-semibold">Grupsuz konular</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Bu etiketler bir müfredat grubuna bağlanmadı. Bazıları birden fazla başlığı kapsar. İPTAL bir müfredat konusu değildir. Özetten çıkarılmazlar.</p>
          {admin ? <Link href="/yks27/admin/topics" className="mt-3 inline-flex text-accent hover:underline">Konu yönetiminde eşle</Link> : <p className="mt-3 text-sm text-muted">Eşlemeyi yalnızca yönetici değiştirebilir.</p>}
        </header>
        {view.unassigned.length === 0 ? <p className="border-t border-border px-4 py-4 text-muted">Bu filtrede grupsuz konu yok.</p> : view.unassigned.map(topic => <TopicLink key={topic.id} topic={topic} href={`/yks27/tyt/topics${topicQuery({ range, subject, q, sort, topic: topic.id })}#konu-detayi`} />)}
      </section>
    </>}
  </div></main>;
}
