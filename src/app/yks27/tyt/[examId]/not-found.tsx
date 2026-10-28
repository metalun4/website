import Link from "next/link";

export default function ExamNotFound() {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-16 text-foreground"><p className="text-muted">404</p><h1 id="yks-content" tabIndex={-1} className="mt-3 text-2xl font-semibold">TYT denemesi bulunamadı</h1><p className="mt-3 text-muted">Bu bağlantıya ait TYT denemesi yok.</p><Link href="/yks27/tyt" className="mt-6 inline-flex items-center text-accent hover:underline">← TYT denemeleri</Link></main>;
}
