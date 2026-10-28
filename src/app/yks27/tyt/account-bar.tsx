import Link from "next/link";
import { logout } from "../actions";
import { SectionNav } from "../section-nav";

export function AccountBar({ admin }: { admin: boolean }) {
  return <header className="mb-8 border-b border-border">
    <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
      <Link href="/yks27" className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight">YKS <span className="text-accent">2027</span></Link>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="rounded-full bg-accent-soft px-3 py-1.5 text-accent">{admin ? "Yönetici" : "İzleyici · Salt okunur"}</span>
        <form action={logout}><button className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted hover:text-foreground">Çıkış yap</button></form>
      </div>
    </div>
    <SectionNav admin={admin} />
  </header>;
}
