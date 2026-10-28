import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { calculateExam, dateLabel, difference, number } from "./tyt/data";
import { AccountBar } from "./tyt/account-bar";

export const metadata: Metadata = {
  title: "YKS 2027 | Gelişim Panelleri",
  description: "YKS 2027 deneme sonuçları ve gelişimin.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function Yks27() {
  const current = await requireSession();
  const exams = (await getExams()).map(exam => ({ ...calculateExam(exam), id: exam.id }));
  const latest = exams.at(-1), previous = exams.at(-2);
  return <main className="yks-page"><div className="mx-auto max-w-7xl">
    <AccountBar admin={current.role === "admin"} />
    <header className="mb-6"><h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">Hazırlığına genel bakış</h1><p className="mt-3 text-muted">Son sonucunu incele, gelişimini takip et ve soru analizini incele.</p></header>
    {latest ? <section aria-labelledby="latest-heading" className="yks-panel mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-medium text-accent">SON TYT DENEMEN</p><h2 id="latest-heading" className="mt-2 break-words text-xl font-semibold">{latest.name}</h2><p className="mt-2 text-sm text-muted"><time dateTime={latest.date}>{dateLabel(latest.date)}</time></p></div><Link href={`/yks27/tyt/${latest.id}`} className="yks-button yks-button-primary">Son denemeyi incele</Link></div>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-5">
        <div><dt className="text-xs text-muted">Toplam net</dt><dd className="mt-2 text-2xl font-semibold text-accent tabular-nums">{number(latest.net)}</dd></div>
        <div><dt className="text-xs text-muted">Önceki denemeye göre</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{previous ? number(difference(latest.net, previous.net), 2, true) : "—"}</dd>{!previous && <p className="mt-1 text-xs text-muted">İlk denemen</p>}</div>
        <div><dt className="text-xs text-muted">Deneme sayısı</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{exams.length}</dd></div>
      </dl>
    </section> : <section className="yks-panel mb-6"><h2 className="text-xl font-semibold">İlk denemenle başlayalım</h2><p className="mt-3 text-muted">{current.role === "admin" ? "Bireysel TYT karneni PDF olarak ekle; netlerin ve konu analizin burada görünsün." : "Yönetici ilk denemeyi eklediğinde sonuçların burada görünecek."}</p>{current.role === "admin" && <Link href="/yks27/admin" className="yks-button yks-button-primary mt-4">Deneme ekle</Link>}</section>}
    <div className="grid gap-4 md:grid-cols-2">
      <Link href="/yks27/tyt/dashboard" className="yks-panel yks-featured group flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Gelişim paneli</h2><p className="mt-2 leading-6 text-muted">Net değişimini ve derslerinin gelişimini karşılaştır.</p></div><ArrowUpRight className="shrink-0 text-accent" size={22} aria-hidden="true" /></Link>
      <Link href="/yks27/tyt" className="yks-panel group flex items-center justify-between gap-4 hover:border-subtle hover:bg-surface-muted"><div><h2 className="text-lg font-semibold">TYT denemeleri</h2><p className="mt-2 leading-6 text-muted">Tüm sonuçlarını bul, ders ve soru analizlerini incele.</p></div><ArrowUpRight className="shrink-0 text-subtle" size={22} aria-hidden="true" /></Link>
    </div>
    <p className="mt-6 text-sm text-muted">AYT takip alanı hazırlanıyor. <Link href="/yks27/ayt" className="inline-flex items-center text-accent hover:underline">AYT durumu</Link></p>
  </div></main>;
}
