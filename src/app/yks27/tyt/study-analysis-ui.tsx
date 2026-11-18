import Link from "next/link";

export function StudyFirstUsePrompt() {
  return <p className="text-sm leading-6 text-muted">İşlediğin konuları karşılaştırmak için <Link href="/yks27/tyt/study" className="inline-flex min-h-11 items-center text-accent hover:underline">İşlenen konular sayfasında bitirdiğin tarihleri ekle</Link>.</p>;
}

export function StudyUnavailable({ state, retryHref }: { state: "error" | "unavailable"; retryHref: string }) {
  return <p className="text-sm leading-6 text-muted" role={state === "error" ? "alert" : undefined}>
    {state === "error" ? "İşlenen konu analizi yüklenemedi. Sayfayı yenileyip tekrar dene." : "Bu denemenin işlenen konu analizi şu anda kullanılamıyor. Soru bilgileri eksik veya raporla eşleşmiyor."}{" "}
    <a href={retryHref} className="inline-flex min-h-11 items-center text-accent hover:underline">Analizi tekrar yükle</a>
  </p>;
}
