"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";

export function SectionNav({ admin, onNavigate }: { admin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const links = [
    { href: "/yks27", label: "Genel bakış" },
    { href: "/yks27/tyt", label: "TYT denemeleri" },
    { href: "/yks27/tyt/dashboard", label: "Gelişim paneli" },
    { href: "/yks27/tyt/topics", label: "Konu başarısı" },
    { href: "/yks27/tyt/study", label: "İşlenen konular" },
    { href: "/yks27/ayt", label: "AYT" },
    ...(admin ? [{ href: "/yks27/admin", label: "Yönetim" }] : []),
  ];
  return <nav aria-label="YKS sayfaları" className="yks-navigation">
    {links.map(link => {
      const examDetail = link.href === "/yks27/tyt" && /^\/yks27\/tyt\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname);
      const nestedAdmin = link.href === "/yks27/admin" && pathname.startsWith("/yks27/admin/");
      const current = pathname === link.href || nestedAdmin ? "page" : examDetail ? "location" : undefined;
      return <Link key={link.href} href={link.href} aria-current={current} onClick={onNavigate}>{link.label}</Link>;
    })}
  </nav>;
}

export function MobileNav({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="yks-mobile-menu"><Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Gezinme menüsünü aç"><Menu aria-hidden="true" /></Button></SheetTrigger>
    <SheetContent side="left" className="yks yks-sheet">
      <SheetHeader><SheetTitle>YKS 2027</SheetTitle><SheetDescription>Çalışma alanın</SheetDescription></SheetHeader>
      <SectionNav admin={admin} onNavigate={() => setOpen(false)} />
    </SheetContent>
  </Sheet></div>;
}
