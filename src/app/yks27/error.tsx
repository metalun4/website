"use client";

import Link from "next/link";
import { useTransition } from "react";

export default function WorkspaceError({ retry }: { error: unknown; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return <main className="yks-page"><div className="mx-auto max-w-3xl">
    <nav aria-label="Hata sonrası gezinme" className="yks-jump-links mb-8"><Link href="/yks27">Genel bakış</Link><Link href="/yks27/tyt">TYT denemeleri</Link><Link href="/yks27/login">Giriş</Link></nav>
    <section className="yks-panel"><h1 id="yks-content" tabIndex={-1} className="text-2xl font-semibold">Sayfa yüklenemedi</h1>
      <p role="alert" className="mt-3 leading-7 text-muted">Verilere şu anda ulaşılamıyor. Bağlantını kontrol edip yeniden dene.</p>
      <button type="button" disabled={pending} onClick={() => startTransition(retry)} className="yks-button mt-6">{pending ? "Yeniden yükleniyor…" : "Tekrar dene"}</button>
    </section>
  </div></main>;
}
