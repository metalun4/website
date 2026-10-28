import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin, getAdminPins } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { PinForm, RemoveButton } from "../forms";
import { ImportForm } from "./import-form";
import { AccountBar } from "../tyt/account-bar";
import { dateLabel } from "../tyt/data";

export const metadata: Metadata = { title: "Yönetim | YKS 2027", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Admin() {
  await requireAdmin();
  const [exams, pins] = await Promise.all([getExams(), getAdminPins()]);
  return <main className="yks-page"><div className="mx-auto max-w-5xl">
    <AccountBar admin />
    <header className="mb-6"><h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold">Yönetim</h1></header>
    <nav aria-label="Yönetim bölümleri" className="yks-jump-links mb-6"><a href="#import">Deneme ekle</a><a href="#viewer-access">İzleyici erişimi</a><a href="#exam-records">Kayıtlar ({exams.length})</a></nav>
    <section id="import" className="yks-panel mb-7 scroll-mt-6"><h2 className="mb-3 text-xl font-semibold">PDF’den deneme ekle</h2><p className="mb-5 text-muted">Raporu seç, sonuçları önizle ve doğruladıktan sonra içe aktar.</p><ImportForm /></section>
    <section id="viewer-access" className="yks-panel mb-7 scroll-mt-6"><h2 className="mb-3 text-xl font-semibold">İzleyici erişimi</h2><p className="mb-5 leading-6 text-muted">Her kişi için ayrı PIN oluştur. Erişim iptal edildiğinde bu PIN ile açılan oturumlar da kapanır.</p><PinForm /><ul className="mt-6 divide-y divide-border">{pins.map(pin => <li key={pin.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><strong className="break-words">{pin.label}</strong><p className="mt-1 text-xs text-muted">Son tarih: {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(pin.expires_at))} · {pin.status}</p></div>{!pin.revoked && <RemoveButton kind="pin" id={pin.id} label={pin.label} />}</li>)}</ul></section>
    <section id="exam-records" className="yks-panel scroll-mt-6"><h2 className="mb-4 text-xl font-semibold">Denemeler ({exams.length})</h2>{!exams.length && <p className="text-muted">Henüz kayıt yok. Yukarıdan ilk denemeyi ekleyebilirsin.</p>}<ul className="divide-y divide-border">{exams.toReversed().map(exam => <li key={exam.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><Link href={`/yks27/tyt/${exam.id}`} className="inline-flex items-center break-words font-semibold hover:text-accent hover:underline">{exam.name}</Link><p className="mt-1 text-muted">{dateLabel(exam.date)}</p></div><RemoveButton kind="exam" id={exam.id} label={exam.name} /></li>)}</ul></section>
  </div></main>;
}
