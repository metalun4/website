"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SectionNav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/yks27", label: "Genel bakış" },
    { href: "/yks27/tyt", label: "TYT denemeleri" },
    { href: "/yks27/tyt/dashboard", label: "Gelişim paneli" },
    { href: "/yks27/tyt/topics", label: "Konu başarısı" },
    { href: "/yks27/ayt", label: "AYT" },
    ...(admin ? [{ href: "/yks27/admin", label: "Yönetim" }] : []),
  ];
  return <nav aria-label="YKS sayfaları" className="yks-navigation">
    {links.map(link => {
      const examDetail = link.href === "/yks27/tyt" && /^\/yks27\/tyt\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname);
      const nestedAdmin = link.href === "/yks27/admin" && pathname.startsWith("/yks27/admin/");
      const current = pathname === link.href || nestedAdmin ? "page" : examDetail ? "location" : undefined;
      return <Link key={link.href} href={link.href} aria-current={current}>{link.label}</Link>;
    })}
  </nav>;
}
