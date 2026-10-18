import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, getAdminPins } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { ExamForm, PinForm, RemoveButton } from "../forms";
import { logout } from "../actions";
import { dateLabel } from "../tyt/data";

export const metadata: Metadata = { title: "Yönetim | YKS 2027", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Admin({ searchParams }: { searchParams: Promise<{ edit?: string; saved?: string }> }) {
  await requireAdmin();
  const { edit, saved } = await searchParams;
  const exams = await getExams();
  const pins = await getAdminPins();
  const selected = exams.find(exam => exam.id === edit);
  if (edit && !selected) notFound();
  return <main className="min-h-screen bg-background px-4 py-10 text-left text-sm text-foreground" lang="tr"><div className="mx-auto max-w-5xl"><header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><Link href="/yks27/tyt" className="text-muted hover:underline">← TYT denemeleri</Link><h1 className="mt-3 text-3xl font-semibold">Yönetim</h1></div><form action={logout}><button className="rounded-lg border border-border px-4 py-2">Çıkış yap</button></form></header>
    {saved && <p role="status" className="mb-5">Kayıt kaydedildi.</p>}
    <section className="mb-8 rounded-xl border border-border bg-surface p-5"><h2 className="mb-5 text-xl font-semibold">{selected ? "Denemeyi düzenle" : "Yeni deneme"}</h2>{selected && <Link href="/yks27/admin" className="mb-4 block underline">Düzenlemeyi iptal et</Link>}<ExamForm key={selected?.id ?? "new"} exam={selected} /></section>
    <section className="mb-8 rounded-xl border border-border bg-surface p-5"><h2 className="mb-5 text-xl font-semibold">Denemeler ({exams.length})</h2>{!exams.length && <p>Henüz kayıt yok. İlk denemenizi ekleyin.</p>}<ul className="divide-y divide-border">{exams.map(exam => <li key={exam.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong>{exam.name}</strong><p className="mt-1 text-muted">{dateLabel(exam.date)}</p></div><div className="flex items-center gap-3"><Link className="underline" href={`/yks27/admin?edit=${exam.id}`}>Düzenle</Link><RemoveButton kind="exam" id={exam.id} /></div></li>)}</ul></section>
    <section className="mb-8 rounded-xl border border-border bg-surface p-5"><h2 className="mb-3 text-xl font-semibold">İzleyici erişimi</h2><p className="mb-5 text-muted">Her kişi için ayrı PIN oluşturun. PIN iptal edildiğinde açık oturumlarının erişimi de biter.</p><PinForm /><ul className="mt-6 divide-y divide-border">{pins.map(pin => <li key={pin.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong>{pin.label}</strong><p className="mt-1 text-xs text-muted">Son tarih: {new Date(pin.expires_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} · {pin.status}</p></div>{!pin.revoked && <RemoveButton kind="pin" id={pin.id} />}</li>)}</ul></section>
  </div></main>;
}
