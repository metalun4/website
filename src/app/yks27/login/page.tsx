import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { session } from "@/lib/session";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Giriş | YKS 2027", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Login() {
  if (await session()) redirect("/yks27/tyt");
  return <main className="min-h-screen bg-background px-4 py-16 text-left text-sm text-foreground" lang="tr"><div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-6"><Link href="/yks27" className="text-muted">← YKS 2027</Link><h1 className="mt-6 mb-6 text-2xl font-semibold">Panele giriş</h1><LoginForm /></div></main>;
}
