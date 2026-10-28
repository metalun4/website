"use client";

import Link from "next/link";
import { useTransition } from "react";

export default function ExamError({ retry }: { error: unknown; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-16 text-foreground"><h1 id="yks-content" tabIndex={-1} className="text-2xl font-semibold">Deneme raporu yüklenemedi</h1><p role="alert" className="mt-3 text-muted">Verilere şu anda ulaşılamıyor. Bağlantını kontrol edip yeniden dene.</p><div className="mt-6 flex flex-wrap items-center gap-5"><button type="button" disabled={pending} onClick={() => startTransition(retry)} className="yks-button">{pending ? "Yeniden yükleniyor…" : "Tekrar dene"}</button><Link href="/yks27/tyt" className="inline-flex items-center text-accent hover:underline">← TYT denemeleri</Link><Link href="/yks27" className="inline-flex items-center text-accent hover:underline">Genel bakış</Link></div></main>;
}
