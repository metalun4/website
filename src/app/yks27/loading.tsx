import Link from "next/link";

export default function Loading() {
  return <main className="yks-page" aria-busy="true"><div className="mx-auto max-w-7xl">
    <nav aria-label="Yüklenirken gezinme" className="yks-jump-links mb-8"><Link href="/yks27">Genel bakış</Link><Link href="/yks27/tyt">TYT denemeleri</Link></nav>
    <h1 id="yks-content" tabIndex={-1} className="text-2xl font-semibold">Sayfa yükleniyor…</h1>
    <p role="status" className="mt-3 text-muted">Sonuçların hazırlanıyor. Diğer sayfalara geçebilirsin.</p>
    <div aria-hidden="true" className="mt-6 grid grid-cols-2 gap-3"><div className="h-24 rounded-xl bg-surface-muted" /><div className="h-24 rounded-xl bg-surface-muted" /><div className="col-span-full h-64 rounded-xl bg-surface-muted" /></div>
  </div></main>;
}
