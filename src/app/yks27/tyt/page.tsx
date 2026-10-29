import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { queryValue, type Query } from "@/lib/yks-navigation";
import { AccountBar } from "./account-bar";
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
    <AccountBar admin={current.role === "admin"} />
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">TYT denemeleri</h1><p className="mt-2 text-muted">{all.length} deneme · En yeniden eskiye</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/yks27/tyt/topics" className="yks-button">Konu başarısı</Link><Link href="/yks27/tyt/dashboard" className="yks-button yks-button-primary">Gelişim paneli</Link></div>
    </header>
    {all.length > 0 && <form action="/yks27/tyt" className="yks-panel mb-6 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2">
      <label className="block">Deneme ara<input type="search" name="q" autoComplete="off" defaultValue={q} maxLength={100} placeholder="Örn. ÖZDEBİR…" className="yks-input mt-1" /></label>
      <button className="yks-button mt-6 self-start">Filtrele</button>
      <details open={Boolean(from || to)} className="col-span-full"><summary className="inline-flex min-h-11 items-center text-sm text-muted">Tarih aralığı{from || to ? " · Filtre etkin" : " (isteğe bağlı)"}</summary><div className="mb-3 grid gap-3 sm:grid-cols-2">
        <label className="block">Başlangıç tarihi<input type="date" name="from" defaultValue={from} max={to || undefined} className="yks-input mt-1" /></label>
        <label className="block">Bitiş tarihi<input type="date" name="to" defaultValue={to} min={from || undefined} className="yks-input mt-1" /></label>
      </div></details>
      {filtered && <Link href="/yks27/tyt" className="col-span-full inline-flex items-center text-accent hover:underline">Filtreleri temizle</Link>}
    </form>}
    {!all.length ? <section className="yks-panel"><h2 className="text-lg font-semibold">Henüz deneme kaydı yok</h2><p className="mt-2 text-muted">{current.role === "admin" ? "İlk deneme raporunu PDF olarak ekleyebilirsin." : "Yönetici bir deneme eklediğinde sonuçlar burada görünecek."}</p>{current.role === "admin" && <Link href="/yks27/admin" className="yks-button mt-4">İlk denemeyi ekle</Link>}</section> : <>
      {filtered && <p role="status" className="mb-4 text-muted">{exams.length} / {all.length} deneme gösteriliyor</p>}
      {!exams.length && <section className="yks-panel"><h2 className="font-semibold">Bu filtrelere uygun deneme yok</h2><p className="mt-2 text-muted">Deneme adını veya tarih aralığını değiştir.</p><Link href="/yks27/tyt" className="yks-button mt-4">Tüm denemeleri göster</Link></section>}
      <div className="space-y-4">{exams.map(exam => <article key={exam.id} aria-labelledby={`exam-${exam.id}`} className="yks-exam-card min-w-0 rounded-xl border border-border bg-surface">
        <header className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5">
          <div className="min-w-0"><h2 id={`exam-${exam.id}`} className="break-words text-base font-semibold"><Link href={`/yks27/tyt/${exam.id}`} prefetch={false} className="hover:text-accent hover:underline">{exam.name}</Link></h2><p className="mt-2 text-xs leading-6 text-muted"><time dateTime={exam.date}>{dateLabel(exam.date)}</time>{exam.rank !== null && <> · Sıralama: {number(exam.rank, 0)} / {number(exam.participants, 0)}</>}</p></div>
          <div className="flex items-center justify-between gap-4 sm:justify-end"><p className="shrink-0 text-accent"><strong className="text-2xl font-semibold tabular-nums">{number(exam.net)}</strong><span className="ml-1 text-xs">net</span></p><Link href={`/yks27/tyt/${exam.id}`} prefetch={false} aria-label={`${exam.name}: Raporu incele`} className="yks-button">Raporu incele</Link></div>
        </header>
        <details className="border-t border-border"><summary className="flex min-h-11 items-center px-4 py-3 text-sm font-medium text-accent sm:px-5">Ders sonuçları</summary><SubjectResults exam={exam} /><p className="border-t border-border px-4 py-3 text-xs text-muted">Net = doğru − yanlış / 4.</p></details>
      </article>)}</div>
    </>}
  </div></main>;
}
