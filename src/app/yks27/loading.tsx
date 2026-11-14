import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return <main className="yks-page" aria-busy="true"><div>
    <h1 id="yks-content" tabIndex={-1} className="sr-only">Sonuçlar yükleniyor</h1>
    <Skeleton className="mb-3 h-9 w-80 max-w-full" /><Skeleton className="mb-6 h-5 w-96 max-w-full" />
    <Skeleton className="mb-6 h-28 w-full rounded-xl" />
    <div className="mb-6 flex gap-3"><Skeleton className="h-10 w-44" /><Skeleton className="h-10 w-64 max-w-full" /></div>
    <div className="overflow-hidden rounded-xl border border-border"><Skeleton className="h-12 w-full rounded-none" />{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="m-4 h-6 w-3/4" />)}</div>
    <p role="status" className="sr-only">Sayfa yükleniyor, sonuçlar hazırlanıyor.</p>
  </div></main>;
}
