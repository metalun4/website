export default function Loading() {
  return (
    <main className="yks-page" aria-busy="true">
      <div className="mx-auto max-w-7xl">
        {/* Account bar skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div className="h-9 w-32 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-9 w-24 animate-pulse rounded-lg bg-surface-muted" />
        </div>

        {/* Header skeleton */}
        <header className="mb-6">
          <div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-surface-muted" />
          <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-surface-muted" />
        </header>

        {/* Featured panel skeleton (latest exam / stats) */}
        <section className="yks-panel mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="h-4 w-32 animate-pulse rounded bg-accent-soft" />
              <div className="mt-3 h-7 w-72 max-w-full animate-pulse rounded-lg bg-surface-muted" />
              <div className="mt-2 h-4 w-40 animate-pulse rounded bg-surface-muted" />
            </div>
            <div className="h-11 w-40 animate-pulse rounded-lg bg-accent-soft" />
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-5">
            {[1, 2, 3].map(i => (
              <div key={i}>
                <div className="h-3 w-20 animate-pulse rounded bg-surface-muted" />
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-surface-muted" />
              </div>
            ))}
          </dl>
        </section>

        {/* Cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="yks-panel">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="h-6 w-40 animate-pulse rounded bg-surface-muted" />
                  <div className="mt-3 h-4 w-full max-w-xs animate-pulse rounded bg-surface-muted" />
                  <div className="mt-2 h-4 w-5/6 max-w-xs animate-pulse rounded bg-surface-muted" />
                </div>
                <div className="h-6 w-6 shrink-0 animate-pulse rounded bg-surface-muted" />
              </div>
            </div>
          ))}
        </div>

        {/* Status for screen readers */}
        <p role="status" className="sr-only">
          Sayfa yükleniyor, sonuçlar hazırlanıyor.
        </p>
      </div>
    </main>
  );
}
