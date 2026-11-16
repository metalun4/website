import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { loadStudyCatalog } from "@/lib/topic-study";
import { formatStudyDate, istanbulToday } from "@/lib/topic-study-view";
import { StudySubjectForms } from "./forms";

export const metadata: Metadata = { title: "İşlenen konular | YKS 2027", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const current = await requireSession("/yks27/tyt/study");
  // A read failure has its own state; it must never look like an empty catalog.
  const catalog = await loadStudyCatalog().catch(() => null);
  const today = istanbulToday();
  const subjects = catalog?.subjects.filter(subject => catalog.groups.some(group => group.subjectId === subject.id)) ?? [];
  const completed = catalog?.groups.filter(group => group.completedOn !== null).length ?? 0;
  return <main className="yks-page"><div className="mx-auto max-w-5xl">
    <header className="mb-6">
      <h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">İşlenen konular</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Müfredat gruplarının tamamı burada; denemede henüz sorulmamış gruplar da listelenir. İşlenme bilgisi eksik olması, konunun henüz çalışılmadığı anlamına gelmez.</p>
      <p id="study-date-help" className="mt-3 max-w-3xl text-sm leading-6 text-muted">Bitirdiğim tarih, grubun tamamını bitirdiğin gündür. Önceden çalıştığın konular için yaklaşık bir geçmiş tarih girebilirsin. Bu tarih, hangi denemelerin çalışma sonrası sayılacağını belirler; sonraki tekrarların tarihini girme.</p>
      {current.role === "viewer" ? <p className="mt-3 text-sm text-muted">Salt okunur görünüm. İşlenme kayıtlarını yalnızca yönetici değiştirebilir.</p> : null}
    </header>
    {!catalog ? <section role="alert" className="yks-panel">
      <h2 className="text-xl font-semibold">İşlenen konular yüklenemedi</h2>
      <p className="mt-2 text-sm text-muted">Kayıtlar şu anda okunamıyor. Sayfayı yenileyip tekrar dene.</p>
      <Link href="/yks27/tyt/study" className="mt-3 inline-flex min-h-11 items-center text-accent hover:underline">Tekrar dene</Link>
    </section> : <>
      <p className="mb-4 text-sm text-muted tabular-nums">{catalog.groups.length.toLocaleString("tr-TR")} grup · {completed.toLocaleString("tr-TR")} işlendi · {(catalog.groups.length - completed).toLocaleString("tr-TR")} işlenme bilgisi eksik</p>
      {subjects.length > 0 ? <nav aria-label="Derslere git" className="yks-jump-links mb-6 flex flex-wrap gap-2">{subjects.map(subject => <a key={subject.id} href={`#ders-${subject.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm hover:bg-surface-muted">{subject.name}</a>)}</nav> : <p className="yks-panel">Müfredat grubu bulunamadı.</p>}
      {subjects.map(subject => {
        const groups = catalog.groups.filter(group => group.subjectId === subject.id);
        return <section key={subject.id} id={`ders-${subject.id}`} aria-labelledby={`heading-${subject.id}`} className="mb-8 min-w-0 scroll-mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="yks-band"><h2 id={`heading-${subject.id}`}>{subject.name}</h2><p className="tabular-nums">{groups.filter(group => group.completedOn !== null).length.toLocaleString("tr-TR")} / {groups.length.toLocaleString("tr-TR")} grup işlendi</p></div>
          {current.role === "admin" ? <StudySubjectForms subject={subject} groups={groups} exams={catalog.exams} today={today} /> : <ul className="divide-y divide-border">{groups.map(group => <li key={group.id} className="px-4 py-4 sm:px-6">
            <h3 className="break-words font-medium">{group.name}</h3>
            <p className="mt-1 text-sm text-muted">{group.completedOn ? <>İşlendi · <time dateTime={group.completedOn}>{formatStudyDate(group.completedOn)}</time></> : "İşlenme bilgisi eksik"}</p>
          </li>)}</ul>}
        </section>;
      })}
    </>}
  </div></main>;
}
