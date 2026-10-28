"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SectionNav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/yks27", label: "Genel bakış" },
    { href: "/yks27/tyt", label: "TYT denemeleri" },
    { href: "/yks27/tyt/dashboard", label: "Gelişim paneli" },
    { href: "/yks27/ayt", label: "AYT" },
    ...(admin ? [{ href: "/yks27/admin", label: "Yönetim" }] : []),
  ];
  return <nav aria-label="YKS sayfaları" className="yks-navigation">
    {links.map(link => {
      const detail = link.href === "/yks27/tyt" && pathname.startsWith("/yks27/tyt/") && pathname !== "/yks27/tyt/dashboard";
      return <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : detail ? "location" : undefined}>{link.label}</Link>;
    })}
  </nav>;
}
