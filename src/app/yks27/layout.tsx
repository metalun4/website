import type { Metadata } from "next";
import { session } from "@/lib/session";
import { AccountBar } from "./tyt/account-bar";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function YksLayout({ children }: { children: React.ReactNode }) {
  const current = await session();
  return <div className="yks" lang="tr">
    <a href="#yks-content" className="skip-link">İçeriğe geç</a>
    <TooltipProvider>
      <AccountBar admin={current?.role === "admin"} signedIn={Boolean(current)} />
      {children}
    </TooltipProvider>
  </div>;
}
