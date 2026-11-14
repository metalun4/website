import { Button } from "@/components/ui/button";
import { SummaryStrip } from "./workspace-ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { calculateExam, dateLabel, difference, number } from "./tyt/data";

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
    <header className="mb-6"><h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">Hazırlığına genel bakış</h1><p className="mt-3 text-muted">Son sonucunu incele, gelişimini takip et ve soru analizini incele.</p></header>
    {latest ? <section aria-labelledby="latest-heading" className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 id="latest-heading" className="mt-2 break-words text-xl font-semibold">{latest.name}</h2><p className="mt-2 text-sm text-muted"><time dateTime={latest.date}>{dateLabel(latest.date)}</time></p></div><Button asChild variant="default"><Link href={`/yks27/tyt/${latest.id}`} className=" ">Son denemeyi incele</Link></Button></div>
      <div className="mt-5"><SummaryStrip label="Son deneme özeti" items={[{ label: "Toplam net", value: number(latest.net), lead: true }, { label: "Önceki denemeye göre", value: previous ? number(difference(latest.net,previous.net),2,true) : "—", detail: previous ? undefined : "İlk denemen" }, { label: "Deneme sayısı", value: exams.length }]} /></div>
    </section> : <section className="yks-panel mb-6"><h2 className="text-xl font-semibold">İlk denemenle başlayalım</h2><p className="mt-3 text-muted">{current.role === "admin" ? "Bireysel TYT karneni PDF olarak ekle; netlerin ve konu analizin burada görünsün." : "Yönetici ilk denemeyi eklediğinde sonuçların burada görünecek."}</p>{current.role === "admin" && <Button asChild variant="default"><Link href="/yks27/admin" className="  mt-4">Deneme ekle</Link></Button>}</section>}
    <Card className="yks-subject-card"><CardHeader className="yks-band"><CardTitle><h2>Çalışma alanın</h2></CardTitle><CardDescription>Denemeden çalışma planına</CardDescription></CardHeader><CardContent className="yks-subject-content"><div className="divide-y divide-border">{[
      { href: "/yks27/tyt/topics", title: "Konu Başarı Analizi", description: "Denemelerini birleştir; doğru, yanlış ve boşlarını konu bazında gör." },
      { href: "/yks27/tyt/dashboard", title: "Gelişim paneli", description: "Net değişimini ve derslerinin gelişimini karşılaştır." },
      { href: "/yks27/tyt", title: "TYT denemeleri", description: "Tüm sonuçlarını bul, ders ve soru analizlerini incele." },
    ].map(item => <Link href={item.href} key={item.href} className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-surface-muted"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted">{item.description}</p></div><ArrowUpRight size={20} className="shrink-0 text-accent" aria-hidden="true" /></Link>)}</div></CardContent></Card>
    <p className="mt-6 text-sm text-muted">AYT takip alanı hazırlanıyor. <Link href="/yks27/ayt" className="inline-flex items-center text-accent hover:underline">AYT durumu</Link></p>
  </div></main>;
}
