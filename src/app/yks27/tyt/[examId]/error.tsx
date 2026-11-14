"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTransition } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function ExamError({ retry }: { error: unknown; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return <main className="yks-page"><div><h1 id="yks-content" tabIndex={-1} className="mb-6">Deneme raporu yüklenemedi</h1><Alert><AlertTitle>Verilere şu anda ulaşılamıyor</AlertTitle><AlertDescription>Bağlantını kontrol edip yeniden dene.</AlertDescription></Alert><div className="mt-6 flex flex-wrap items-center gap-5"><Button type="button" disabled={pending} onClick={() => startTransition(retry)} variant="outline">{pending ? "Yeniden yükleniyor…" : "Tekrar dene"}</Button><Button variant="link" asChild><Link href="/yks27/tyt">TYT denemeleri</Link></Button><Button variant="link" asChild><Link href="/yks27">Genel bakış</Link></Button></div></div></main>;
}
