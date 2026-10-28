import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { AccountBar } from "../tyt/account-bar";

export const metadata: Metadata = {
  title: "AYT 2027 | Hazırlanıyor",
  description: "AYT deneme takip alanı hazırlanıyor.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Ayt27() {
  const current = await requireSession("/yks27/ayt");
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground"><div className="mx-auto max-w-7xl"><AccountBar admin={current.role === "admin"} /><section className="rounded-2xl border border-border bg-surface px-6 py-16 text-center">
      <p className="text-sm font-medium tracking-widest text-subtle">AYT 2027</p>
      <h1 id="yks-content" tabIndex={-1} className="mt-4 text-3xl font-semibold tracking-tight">AYT takip alanı hazırlanıyor</h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted">Bu alan henüz kullanıma hazır değil. TYT denemelerini ve gelişim grafiklerini incelemeye devam edebilirsin.</p>
      <Link href="/yks27/tyt" className="mt-6 inline-flex rounded-lg border border-border bg-accent-soft px-5 py-3 text-sm font-medium text-accent hover:bg-surface-muted">TYT denemelerine git</Link>
      </section></div>
    </main>
  );
}
