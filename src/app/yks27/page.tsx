import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { requireSession } from "@/lib/session";
import { AccountBar } from "./tyt/account-bar";

export const metadata: Metadata = {
  title: "YKS 2027 | Gelişim Panelleri",
  description: "YKS 2027 sınav hazırlığı için deneme gelişim panelleri.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Yks27() {
  const current = await requireSession();
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-left text-foreground max-[520px]:px-3 max-[520px]:py-6" lang="tr">
      <div className="mx-auto max-w-7xl">
        <AccountBar admin={current.role === "admin"} />
        <header className="mb-8">
          <div className="mb-6 flex items-center gap-[9px] text-xs font-semibold tracking-[1px] text-muted">
            <BookOpen size={18} aria-hidden="true" /> YKS 2027
          </div>
          <h1 id="yks-content" tabIndex={-1} className="text-[clamp(26px,3.5vw,39px)] leading-tight font-semibold tracking-tight">YKS 2027<span className="text-subtle">.</span></h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">Deneme gelişimini ve sınav performansını takip et.</p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Link href="/yks27/tyt" className="group flex items-center justify-between gap-5 rounded-xl border border-border bg-surface p-6 transition-colors hover:border-subtle hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
            <div>
              <p className="mb-3 text-xs font-medium text-accent">DENEME KAYITLARI</p><h2 className="text-xl font-semibold text-foreground">TYT denemeleri</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">Deneme sonuçları, ders bazında netler ve gelişim paneli.</p>
            </div>
            <ArrowUpRight size={22} className="shrink-0 text-subtle group-hover:text-foreground" aria-hidden="true" />
          </Link>
          <Link href="/yks27/tyt/dashboard" className="yks-featured group flex items-center justify-between gap-5 rounded-xl border p-6">
            <div><p className="mb-3 text-xs font-medium text-accent">PERFORMANS ANALİZİ</p><h2 className="text-xl font-semibold">Gelişim paneli</h2><p className="mt-2 text-sm leading-relaxed text-muted">Net değişimini, doğruluğunu ve ders bazında gelişimini incele.</p></div>
            <ArrowUpRight size={22} className="shrink-0 text-accent" aria-hidden="true" />
          </Link>
          <Link href="/yks27/ayt" className="group flex items-center justify-between gap-5 rounded-xl border border-border bg-surface p-6 transition-colors hover:border-subtle hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
            <div>
              <p className="mb-3 text-xs font-medium text-subtle">HAZIRLANIYOR</p><h2 className="text-xl font-semibold text-foreground">AYT 2027</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">AYT takip alanı henüz kullanıma hazır değil.</p>
            </div>
            <ArrowUpRight size={22} className="shrink-0 text-subtle group-hover:text-foreground" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
