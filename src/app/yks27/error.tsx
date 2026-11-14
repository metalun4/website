"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTransition } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function WorkspaceError({ retry }: { error: unknown; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return <main className="yks-page"><div className="mx-auto max-w-3xl">
    <nav aria-label="Hata sonrası gezinme" className="yks-jump-links mb-8"><Link href="/yks27">Genel bakış</Link><Link href="/yks27/tyt">TYT denemeleri</Link><Link href="/yks27/login">Giriş</Link></nav>
    <section className="yks-panel"><h1 id="yks-content" tabIndex={-1} className="text-2xl font-semibold">Sayfa yüklenemedi</h1>
      <Alert className="mt-4"><AlertTitle>Verilere şu anda ulaşılamıyor</AlertTitle><AlertDescription>Bağlantını kontrol edip yeniden dene.</AlertDescription></Alert>
      <Button type="button" disabled={pending} onClick={() => startTransition(retry)} className=" mt-6">{pending ? "Yeniden yükleniyor…" : "Tekrar dene"}</Button>
    </section>
  </div></main>;
}
