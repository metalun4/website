import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { session } from "@/lib/session";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Giriş | YKS 2027", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Login() {
  if (await session()) redirect("/yks27");
  return <main className="min-h-screen bg-background px-4 py-16 text-left text-sm text-foreground" lang="tr"><div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-6"><Link href="/" className="text-muted">← Ana sayfa</Link><h1 id="yks-content" tabIndex={-1} className="mt-6 mb-3 text-3xl font-semibold tracking-tight">Panele giriş</h1><p className="mb-7 leading-6 text-muted">Deneme sonuçlarını ve gelişim grafiklerini görmek için giriş yap.</p><LoginForm /></div></main>;
}
