import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChartNoAxesCombined, FileText } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { safePdfUrl } from "@/lib/pdf-url";
import { AccountBar } from "./account-bar";
import { calculateExam, dateLabel, number, subjects } from "./data";

export const metadata: Metadata = {
  title: "TYT Denemeleri | YKS 2027",
  description: "TYT denemelerinin ders bazında ve toplam doğru, yanlış, boş ve net sonuçları.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function Tyt() {
  const current = await requireSession();
  const exams = (await getExams()).slice().reverse().map(exam => ({ ...calculateExam(exam), id: exam.id, pdf_url: safePdfUrl(exam.pdf_url) }));
  const numericCell = "px-3 py-3 text-right tabular-nums sm:px-5";

  return <main className="min-h-screen bg-background px-3 py-6 text-left text-sm text-foreground sm:px-5 sm:py-10" lang="tr">
    <div className="mx-auto max-w-7xl">
      <AccountBar admin={current.role === "admin"} />
      <header className="mb-8">
        <Link href="/yks27" className="text-muted hover:underline">← YKS 2027</Link>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-wider text-muted"><BookOpen size={17} aria-hidden="true" /> TYT 2027</div>
            <h1 className="text-3xl font-semibold tracking-tight">TYT Denemeleri<span className="text-subtle">.</span></h1>
            <p className="mt-3 text-muted">{exams.length} deneme · En yeniden eskiye</p>
          </div>
          <Link href="/yks27/tyt/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"><ChartNoAxesCombined size={18} aria-hidden="true" /> Gelişim paneli</Link>
        </div>
      </header>

      {!exams.length && <section className="rounded-xl border border-border bg-surface p-6"><h2 className="text-lg font-semibold">Henüz deneme kaydı yok</h2>{current.role === "admin" && <Link href="/yks27/admin" className="mt-3 inline-block underline">İlk denemeyi ekle</Link>}</section>}

      <div className="space-y-6">{exams.map(exam => <article key={exam.id} aria-labelledby={`exam-${exam.id}`} className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-5 sm:px-6">
          <div><h2 id={`exam-${exam.id}`} className="text-lg font-semibold">{exam.name}</h2><p className="mt-2 text-xs text-muted">{dateLabel(exam.date)}{(exam.rank !== null || exam.participants !== null) && <> · Sıralama: {number(exam.rank, 0)} / {number(exam.participants, 0)}</>}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {exam.pdf_url && <a href={exam.pdf_url} target="_blank" rel="noopener noreferrer" aria-label={`${exam.name} PDF dosyasını görüntüle (yeni sekme)`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-emphasis px-3 py-2 text-xs font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"><FileText size={15} aria-hidden="true" /> PDF’yi görüntüle</a>}
            {current.role === "admin" && <Link href={`/yks27/admin?edit=${exam.id}`} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-surface-muted">Düzenle</Link>}
          </div>
        </header>
        <div className="overflow-x-auto" role="region" aria-label={`${exam.name} sonuçları`} tabIndex={0}>
          <table className="w-full min-w-[620px] text-sm">
            <caption className="sr-only">{exam.name} ders sonuçları ve genel toplam</caption>
            <thead className="bg-surface-muted text-xs text-muted"><tr><th scope="col" className="px-4 py-3 text-left font-medium sm:px-6">Ders</th>{["Soru", "Doğru", "Yanlış", "Boş", "Net", "Ortalama"].map(label => <th scope="col" key={label} className={`${numericCell} font-medium`}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{subjects.map((subject, i) => {
              const result = exam.subjects[i];
              return <tr key={subject.key}><th scope="row" className="px-4 py-3 text-left font-medium sm:px-6">{subject.label}</th><td className={numericCell}>{subject.questions}</td><td className={numericCell}>{number(result.correct, 0)}</td><td className={numericCell}>{number(result.incorrect, 0)}</td><td className={numericCell}>{number(result.empty, 0)}</td><td className={`${numericCell} font-semibold`}>{number(result.net)}</td><td className={`${numericCell} text-muted`}>{number(result.average)}</td></tr>;
            })}</tbody>
            <tfoot className="border-t border-border bg-surface-emphasis font-semibold"><tr><th scope="row" className="px-4 py-4 text-left sm:px-6">Toplam</th><td className={numericCell}>120</td><td className={numericCell}>{number(exam.correct, 0)}</td><td className={numericCell}>{number(exam.incorrect, 0)}</td><td className={numericCell}>{number(exam.empty, 0)}</td><td className={numericCell}>{number(exam.net)}</td><td className={numericCell}>{number(exam.average)}</td></tr></tfoot>
          </table>
        </div>
      </article>)}</div>
    </div>
  </main>;
}
