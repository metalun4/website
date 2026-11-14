import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { WorkspaceEmpty } from "../workspace-ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { queryValue, type Query } from "@/lib/yks-navigation";
import { SubjectResults } from "./subject-results";
import { calculateExam, dateLabel, number } from "./data";

export const metadata: Metadata = {
  title: "TYT Denemeleri | YKS 2027",
  description: "TYT denemelerinin ders bazında sonuçları ve gelişimi.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function Tyt({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const q = queryValue(query.q).trim().slice(0, 100);
  const date = (value: Query[string]) => /^\d{4}-\d{2}-\d{2}$/.test(queryValue(value)) ? queryValue(value) : "";
  const from = date(query.from), to = date(query.to);
  const search = new URLSearchParams();
  if (q) search.set("q", q);
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const current = await requireSession("/yks27/tyt" + (search.size ? `?${search}` : ""));
  const all = (await getExams()).toReversed().map(exam => ({ ...calculateExam(exam), id: exam.id }));
  const exams = all.filter(exam => (!q || exam.name.toLocaleLowerCase("tr-TR").includes(q.toLocaleLowerCase("tr-TR"))) && (!from || exam.date >= from) && (!to || exam.date <= to));
  const filtered = Boolean(q || from || to);
  return <main className="yks-page"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">TYT denemeleri</h1><p className="mt-2 text-muted">{all.length} deneme · En yeniden eskiye</p></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/yks27/tyt/topics" className="">Konu başarısı</Link></Button><Button asChild variant="default"><Link href="/yks27/tyt/dashboard" className=" ">Gelişim paneli</Link></Button></div>
    </header>
    {all.length > 0 && <form action="/yks27/tyt" className="mb-6">
      <FieldGroup className="yks-exam-filters"><Field><FieldLabel htmlFor="exam-search">Deneme ara</FieldLabel><Input id="exam-search" type="search" name="q" autoComplete="off" defaultValue={q} maxLength={100} placeholder="Örn. ÖZDEBİR…" /></Field>
      <Button variant="outline" className="self-end">Filtrele</Button></FieldGroup>
      <details open={Boolean(from || to)} className="yks-date-disclosure col-span-full"><summary>Tarih aralığı{from || to ? " · Filtre etkin" : " (isteğe bağlı)"}</summary><FieldGroup className="yks-date-filters">
        <Field><FieldLabel htmlFor="exam-from">Başlangıç tarihi</FieldLabel><Input id="exam-from" type="date" name="from" defaultValue={from} max={to || undefined} /></Field>
        <Field><FieldLabel htmlFor="exam-to">Bitiş tarihi</FieldLabel><Input id="exam-to" type="date" name="to" defaultValue={to} min={from || undefined} /></Field>
      </FieldGroup></details>
      {filtered && <Link href="/yks27/tyt" className="col-span-full inline-flex items-center text-accent hover:underline">Filtreleri temizle</Link>}
    </form>}
    {!all.length ? <WorkspaceEmpty title="Henüz deneme kaydı yok" href={current.role === "admin" ? "/yks27/admin" : undefined} action="İlk denemeyi ekle">{current.role === "admin" ? "İlk deneme raporunu PDF olarak ekleyebilirsin." : "Yönetici bir deneme eklediğinde sonuçlar burada görünecek."}</WorkspaceEmpty> : <>
      {filtered && <p role="status" className="mb-4 text-muted">{exams.length} / {all.length} deneme gösteriliyor</p>}
      {!exams.length ? <WorkspaceEmpty title="Bu filtrelere uygun deneme yok" href="/yks27/tyt" action="Tüm denemeleri göster">Deneme adını veya tarih aralığını değiştir.</WorkspaceEmpty> : null}
      <div className="flex flex-col gap-4">{exams.map(exam => <Card key={exam.id} aria-labelledby={`exam-${exam.id}`} className="yks-exam-card">
        <CardHeader className="yks-exam-header">
          <div className="min-w-0"><CardTitle><h2 id={`exam-${exam.id}`}><Link href={`/yks27/tyt/${exam.id}`} prefetch={false} className="hover:text-accent hover:underline">{exam.name}</Link></h2></CardTitle><p className="mt-2 text-xs leading-6 text-muted"><time dateTime={exam.date}>{dateLabel(exam.date)}</time>{exam.rank !== null && <> · Sıralama: {number(exam.rank, 0)} / {number(exam.participants, 0)}</>}</p></div>
          <div className="flex items-center justify-between gap-4 sm:justify-end"><p className="shrink-0 text-accent"><strong className="text-2xl font-semibold tabular-nums">{number(exam.net)}</strong><span className="ml-1 text-xs">net</span></p><Button asChild variant="outline"><Link href={`/yks27/tyt/${exam.id}`} prefetch={false} aria-label={`${exam.name}: Raporu incele`} className="">Raporu incele</Link></Button></div>
        </CardHeader><CardContent className="yks-subject-content">
        <details className="border-t border-border"><summary className="flex min-h-11 items-center px-4 py-3 text-sm font-medium text-accent sm:px-5">Ders sonuçları</summary><SubjectResults exam={exam} /><p className="border-t border-border px-4 py-3 text-xs text-muted">Net = doğru − yanlış / 4.</p></details>
      </CardContent></Card>)}</div>
    </>}
  </div></main>;
}
