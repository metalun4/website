import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-5 text-center text-foreground">
      <p className="text-sm font-medium tracking-widest text-subtle">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-sm text-base leading-relaxed text-muted">The page you’re looking for doesn’t exist or has moved.</p>
      <Link href="/" className="mt-3 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">Back to home</Link>
    </main>
  );
}
