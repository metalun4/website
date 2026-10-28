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
  return <main className="min-h-screen bg-background px-4 py-10 text-left text-sm text-foreground" lang="tr"><div className="mx-auto max-w-5xl"><AccountBar admin /><header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><Link href="/yks27/tyt" className="text-muted hover:underline">← TYT denemeleri</Link><h1 id="yks-content" tabIndex={-1} className="mt-3 text-3xl font-semibold">Yönetim</h1></div></header>
    <section className="mb-8 rounded-xl border border-border bg-surface p-5"><h2 className="mb-3 text-xl font-semibold">PDF’den deneme ekle</h2><p className="mb-5 text-muted">Önce raporu önizleyin; sonuçları kontrol ettikten sonra içe aktarmayı onaylayın.</p><ImportForm /></section>
    <section className="mb-8 rounded-xl border border-border bg-surface p-5"><h2 className="mb-5 text-xl font-semibold">Denemeler ({exams.length})</h2>{!exams.length && <p>Henüz kayıt yok. İlk denemenizi ekleyin.</p>}<ul className="divide-y divide-border">{exams.map(exam => <li key={exam.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="break-words">{exam.name}</strong><p className="mt-1 text-muted">{dateLabel(exam.date)}</p></div><div className="flex items-center gap-3"><RemoveButton kind="exam" id={exam.id} /></div></li>)}</ul></section>
    <section className="mb-8 rounded-xl border border-border bg-surface p-5"><h2 className="mb-3 text-xl font-semibold">İzleyici erişimi</h2><p className="mb-5 text-muted">Her kişi için ayrı PIN oluşturun. PIN iptal edildiğinde açık oturumlarının erişimi de biter.</p><PinForm /><ul className="mt-6 divide-y divide-border">{pins.map(pin => <li key={pin.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong>{pin.label}</strong><p className="mt-1 text-xs text-muted">Son tarih: {new Date(pin.expires_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} · {pin.status}</p></div>{!pin.revoked && <RemoveButton kind="pin" id={pin.id} />}</li>)}</ul></section>
  </div></main>;
}
