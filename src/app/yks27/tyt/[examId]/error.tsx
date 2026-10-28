"use client";

import Link from "next/link";

export default function ExamError({ retry }: { error: unknown; retry: () => void }) {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-16 text-foreground"><h1 id="yks-content" tabIndex={-1} className="text-2xl font-semibold">Deneme raporu yüklenemedi</h1><p role="alert" className="mt-3 text-muted">Verilere şu anda ulaşılamıyor. Lütfen tekrar deneyin.</p><div className="mt-6 flex flex-wrap items-center gap-5"><button type="button" onClick={retry} className="rounded-lg border border-border bg-surface px-4 py-2">Tekrar dene</button><Link href="/yks27/tyt" className="text-accent hover:underline">← TYT denemeleri</Link></div></main>;
}
