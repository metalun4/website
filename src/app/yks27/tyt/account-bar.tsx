import Link from "next/link";
import { logout } from "../actions";

export function AccountBar({ admin }: { admin: boolean }) {
  return <nav aria-label="Hesap" className="mb-6 flex flex-wrap items-center justify-end gap-4 text-xs text-muted">
    <span>{admin ? "Yönetici" : "İzleyici · Salt okunur"}</span>
    {admin && <Link href="/yks27/admin" className="rounded-lg border border-border px-3 py-2 text-foreground hover:bg-surface">Kayıtlar ve PIN yönetimi</Link>}
    <form action={logout}><button className="rounded-lg border border-border px-3 py-2 hover:text-foreground">Çıkış yap</button></form>
  </nav>;
}
