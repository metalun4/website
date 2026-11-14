import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { loadTopicAnalysis, loadTopicBreakdown } from "@/lib/topic-analysis";
import { SUBJECTS } from "@/lib/exam-import/types";
import { buildTopicView, topicSubjectAllowed, type VisibleTopic } from "@/lib/topic-view";
import { MISS_RATE, MIN_EXAMS, MIN_VALID_QUESTIONS, STRONG_RATE, isUuid, readingLabels, topicGroupIds, topicQuery, topicRange, topicSort } from "@/lib/topic-stats";
import { GroupStateProvider, GroupStateInput, TopicFilterForm } from "./group-state";
import { queryValue, type Query } from "@/lib/yks-navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { SummaryStrip, WorkspaceEmpty } from "../../workspace-ui";
import { RangeControl, DetailsSwitch } from "../../url-controls";
import { KarneTable } from "./karne-table";
import { TopicDetail } from "./topic-detail";
import { dateLabel, formatPercent, number } from "../data";

export const metadata: Metadata = { title: "Konu Başarı Analizi | YKS 2027", description: "TYT denemelerinde konu gruplarına göre doğru, yanlış, boş ve net dağılımı.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const wholePercent = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const rateLabel = (value: number | null) => value === null ? "Soru yok" : formatPercent(value);

function RankList({ title, topics, hrefFor }: { title: string; topics: VisibleTopic[]; hrefFor: (topic: VisibleTopic) => string }) {
  return <section><h3>{title}</h3>{topics.length ? <ol>{topics.map(topic => <li key={topic.id}><Link href={hrefFor(topic)}>{topic.name}</Link><p>{topic.metrics.valid} soruda {topic.metrics.correct} doğru · {topic.metrics.wrong} yanlış · {topic.metrics.blank} boş · {readingLabels[topic.reading]}</p></li>)}</ol> : <p className="mt-2">Bu aralıkta listelenecek konu yok.</p>}</section>;
}

export default async function TopicAnalysisPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const range = topicRange(queryValue(query.range)), sort = topicSort(queryValue(query.sort));
  const requestedSubject = queryValue(query.subject);
  const subject = topicSubjectAllowed(requestedSubject) ? requestedSubject : "";
  const q = queryValue(query.q).trim().slice(0, 100);
  const topicId = isUuid(queryValue(query.topic)) ? queryValue(query.topic) : "";
  const groupId = query.group === undefined ? "" : topicGroupIds(query.group).join(",") || "none";
  const detail = queryValue(query.view) === "detail";
  const params = { range, subject, q, sort, topic: topicId, group: groupId, view: detail ? "detail" : "" };
  const session = await requireSession(`/yks27/tyt/topics${topicQuery(params)}`);
  const [analysis, breakdown] = await Promise.all([loadTopicAnalysis(range), topicId ? loadTopicBreakdown(topicId, range) : Promise.resolve(null)]);
  const view = buildTopicView(analysis, { subjectId: subject, query: q, sort });
  const admin = session.role === "admin";
  const topicHrefFor = (topic: VisibleTopic) => `/yks27/tyt/topics${topicQuery({ ...params, topic: topic.id })}#konu-detayi`;
  const dates = analysis.exams.map(exam => exam.examDate).sort();
  const filtered = Boolean(subject || q || range !== "all" || sort !== "performance");
  const searchGroups = q ? view.sections.flatMap(section => section.subjects.flatMap(subject => subject.groups.filter(group => group.topics.length).map(group => group.id))) : [];
  return <GroupStateProvider searchGroups={searchGroups}><main className="yks-page"><div>
    <header className="yks-page-heading"><div><h1 id="yks-content" tabIndex={-1}>Konu Başarı Analizi</h1><p className="yks-context">{analysis.exams.length} deneme birleştirildi{dates.length ? ` · ${dateLabel(dates[0])} — ${dateLabel(dates.at(-1)!)}` : ""}</p></div><div className="yks-heading-actions"><RangeControl value={range} /><DetailsSwitch checked={detail} /></div></header>
    {!analysis.examTotal ? <WorkspaceEmpty title="Henüz deneme kaydı yok" href={admin ? "/yks27/admin" : undefined} action="İlk denemeyi ekle">İlk deneme eklendiğinde konu grupları burada dolacak. Boş gruplar düşük başarı sayılmaz.</WorkspaceEmpty> : <>
      <SummaryStrip label="Seçilen aralığın özeti" items={[{ label: "Soru sayısı", value: number(view.overall.valid, 0) }, { label: "Doğru", value: number(view.overall.correct, 0), tone: "correct" }, { label: "Yanlış", value: number(view.overall.wrong, 0), tone: "incorrect" }, { label: "Boş", value: number(view.overall.blank, 0) }, { label: "Başarı", value: rateLabel(view.overall.success) }]} />
      <section aria-label="Konu analizi filtreleri" className="mb-6"><TopicFilterForm>
        <GroupStateInput />
        {Object.entries({ range: range === "all" ? "" : range, view: params.view, topic: topicId }).map(([name,value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
        <FieldGroup className="yks-filter-fields">
          <Field><FieldLabel htmlFor="topic-subject" className="sr-only">Ders</FieldLabel><NativeSelect id="topic-subject" name="subject" defaultValue={subject}><NativeSelectOption value="">Tüm dersler</NativeSelectOption>{SUBJECTS.filter(item => item.count > 0).map(item => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field>
          <Field><FieldLabel htmlFor="topic-search" className="sr-only">Grup veya konu ara</FieldLabel><Input id="topic-search" type="search" name="q" defaultValue={q} maxLength={100} autoComplete="off" placeholder="Konu ara…" /></Field>
          <Field><FieldLabel htmlFor="topic-sort" className="sr-only">Sıralama</FieldLabel><NativeSelect id="topic-sort" name="sort" defaultValue={sort}><NativeSelectOption value="performance">Başarıya göre</NativeSelectOption><NativeSelectOption value="questions">Soru sayısına göre</NativeSelectOption><NativeSelectOption value="name">Ada göre</NativeSelectOption></NativeSelect></Field><Button variant="outline">Filtrele</Button>
        </FieldGroup>
      </TopicFilterForm><div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Derslere git" className="yks-jump-links">{view.sections.map(section => <a key={section.id} href={`#ders-${section.id}`}>{section.name}</a>)}<a href="#gruplanmamis">Grupsuz konular</a></nav>{filtered ? <Button variant="link" asChild><Link href={detail ? "/yks27/tyt/topics?view=detail" : "/yks27/tyt/topics"}>Filtreleri temizle</Link></Button> : null}</div></section>
      {breakdown ? <TopicDetail breakdown={breakdown} subjectName={analysis.subjects.find(item => item.id === breakdown.topic?.subjectId)?.name ?? "Ders"} closeHref={`/yks27/tyt/topics${topicQuery({ ...params, topic: "" })}`} /> : null}
      {!view.sections.length && !view.unassigned.length ? <WorkspaceEmpty title="Bu aramada konu bulunamadı">Konu adını veya ders filtresini değiştir.</WorkspaceEmpty> : null}
      {view.sections.map(section => <Card key={section.id} id={`ders-${section.id}`} className="yks-subject-card">
        <CardHeader className="yks-band"><CardTitle><h2>{section.name}</h2></CardTitle><CardDescription><span className="text-foreground">{section.subjects.reduce((sum,item) => sum + item.metrics.valid,0)} soru</span> · {section.subjects.reduce((sum,item) => sum + item.metrics.correct,0)} D · {section.subjects.reduce((sum,item) => sum + item.metrics.wrong,0)} Y · {section.subjects.reduce((sum,item) => sum + item.metrics.blank,0)} B</CardDescription></CardHeader>
        <CardContent className="yks-subject-content">{section.subjects.map(subjectRow => <section key={subjectRow.id} aria-label={subjectRow.name}>{section.subjects.length > 1 ? <h3 className="yks-subheading">{subjectRow.name} <span className="font-normal text-muted">· {subjectRow.metrics.valid} soru · {rateLabel(subjectRow.metrics.success)}</span></h3> : null}{subjectRow.groups.length ? <KarneTable groups={subjectRow.groups} detail={detail} params={params} caption={subjectRow.name} /> : <p className="p-4 text-muted">Bu aramada görünen grup yok.</p>}{subjectRow.unassignedQuestions ? <p className="px-6 py-2 text-xs text-muted">{subjectRow.unassignedQuestions} grupsuz soru aşağıdaki bölümde.</p> : null}</section>)}</CardContent>
      </Card>)}
      <Card id="gruplanmamis" className="yks-subject-card"><CardHeader className="yks-band"><CardTitle><h2>Grupsuz konular</h2></CardTitle>{admin ? <Button asChild variant="link"><Link href="/yks27/admin/topics">Konu yönetiminde eşle</Link></Button> : null}</CardHeader><CardContent className="yks-subject-content"><p className="px-6 py-4 text-sm text-muted">Bu etiketler bir müfredat grubuna bağlanmadı. Özetten çıkarılmazlar. İPTAL bir müfredat konusu değildir.{!admin ? " Eşlemeyi yalnızca yönetici değiştirebilir." : ""}</p>{view.unassigned.length ? <KarneTable topics={view.unassigned} detail={detail} params={params} caption="Grupsuz konular" /> : <p className="px-6 pb-4 text-muted">Bu filtrede grupsuz konu yok.</p>}</CardContent></Card>
      {detail ? <section className="mt-8" aria-labelledby="priority-heading"><h2 id="priority-heading" className="text-lg font-semibold">Öne çıkan konular</h2><div className="yks-priorities"><RankList title="En çok yanlış" topics={view.topWrong} hrefFor={topicHrefFor} /><RankList title="En çok boş" topics={view.topBlank} hrefFor={topicHrefFor} /><RankList title="Güçlü performans" topics={view.topStrong} hrefFor={topicHrefFor} /></div><Separator /><section className="mt-6 max-w-3xl text-sm leading-6 text-muted"><h2 className="mb-3 font-semibold text-foreground">Bu sayılar neyi ölçer?</h2><p>Başarı = doğru / geçerli soru. Deneme oranı = cevaplanan / geçerli soru. Denenenlerde doğruluk = doğru / cevaplanan soru. Net = doğru − yanlış / 4. Boşlar başarıyı düşürür; doğruluğu ise yalnızca denenen sorulardan hesaplanır.</p><p className="mt-3">Güçlü performans için en az {MIN_EXAMS} deneme, {MIN_VALID_QUESTIONS} geçerli soru ve {wholePercent.format(STRONG_RATE)} başarı ile denenen doğruluk gerekir. Yanlışlar, yanlış payı {wholePercent.format(MISS_RATE)} veya üzeri ve boşlardan az değilse öne çıkar. Boşlar, boş payı bu eşiği geçip yanlışlardan fazlaysa öne çıkar. Daha az gözlem yorumlanmaz.</p><p className="mt-3">Bu özette {view.overall.valid + view.overall.cancelled} soru var. {view.grouped.valid + view.grouped.cancelled} soru bir gruba bağlı. {view.unassignedAll.reduce((sum,topic) => sum + topic.counts.valid + topic.counts.cancelled,0)} soru grupsuz ve özete bir kez dahil. {view.overall.cancelled ? `${view.overall.cancelled} iptal soru resmi nette doğru sayılır, konu başarısına katılmaz.` : "İptal soru yok."}</p></section></section> : null}
    </>}
  </div></main></GroupStateProvider>;
}
