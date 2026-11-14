import Link from "next/link";
import { logout } from "../actions";
import { SectionNav } from "../section-nav";
import { Button } from "@/components/ui/button";
import { MobileNav } from "../section-nav";

export function AccountBar({ admin, signedIn = true }: { admin: boolean; signedIn?: boolean }) {
  return <header className="yks-topbar"><div className="yks-topbar-inner">
    {signedIn ? <MobileNav admin={admin} /> : null}
    <Link href="/yks27" className="yks-wordmark">YKS <span className="text-accent">2027</span></Link>
    {signedIn ? <div className="yks-desktop-nav"><SectionNav admin={admin} /></div> : null}
    <div className="yks-account">
      <span>{admin ? "Yönetici" : signedIn ? "İzleyici · Salt okunur" : "Öğrenci çalışma alanı"}</span>
      {signedIn ? <form action={logout}><Button variant="ghost">Çıkış yap</Button></form> : null}
    </div>
  </div></header>;
}
