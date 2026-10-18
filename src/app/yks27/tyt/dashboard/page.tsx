import { requireSession } from "@/lib/session";
import { getExams } from "@/lib/exams";
import { AccountBar } from "../account-bar";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowUpRight, BookOpen, CalendarDays, ChartNoAxesCombined, CheckCheck, Crosshair, Layers3, Users } from "lucide-react";
import Chart, { type Series } from "../chart";
import { dateLabel, difference, calculateExam, number, subjects } from "../data";

export const metadata: Metadata = {
  title: "TYT 2027 Gelişim Paneli | YKS 2027",
  description: "TYT denemelerinde net gelişimi, göreli performans, doğruluk ve dengeli performans skoru.",
  robots: { index: false, follow: false },
};


function Section({ index, title, description, icon: Icon, children }: { index: string; title: string; description: string; icon: typeof Activity; children: React.ReactNode }) {
  return <section className="mb-[30px]" aria-labelledby={`section-${index}`}>
    <header className="flex items-center gap-[15px] rounded-t-[11px] border border-border bg-surface-emphasis px-[22px] py-[18px] text-foreground max-[520px]:gap-2.5 max-[520px]:px-[13px] max-[520px]:py-[15px]">
      <span className="border-r border-border pr-[15px] text-xl leading-[1.6] font-normal text-subtle max-[520px]:pr-2.5 max-[520px]:text-[17px]">{index}</span>
      <div><h2 id={`section-${index}`} className="text-base font-semibold tracking-tight max-[520px]:text-sm">{title}</h2><p className="mt-1 text-xs leading-relaxed text-muted">{description}</p></div>
      <Icon className="ml-auto shrink-0 text-subtle max-[520px]:hidden" size={22} aria-hidden="true" />
    </header>
    <div className="grid grid-cols-1 gap-4 rounded-b-xl border border-t-0 border-border bg-surface-muted p-[18px] min-[901px]:grid-cols-2 max-[520px]:gap-2.5 max-[520px]:p-[9px]">{children}</div>
  </section>;
}

function MetricStrip({ metric, latest }: { metric: "accuracy" | "dps"; latest: ReturnType<typeof calculateExam> }) {
  return <div className="col-span-full grid grid-cols-5 rounded-[9px] border border-border bg-surface py-[19px] max-[520px]:grid-cols-2 max-[520px]:gap-y-[18px]" aria-label={`Son sınav ${metric === "accuracy" ? "doğruluk" : "DPS"} değerleri`}>
    {[{ label: "Genel", color: "var(--chart-primary)", value: latest[metric] }, ...subjects.map((s, i) => ({ ...s, value: latest.subjects[i][metric] }))].map(s =>
      <div key={s.label} className="border-r border-border px-5 last:border-0 max-[520px]:px-[15px] max-[520px]:first:col-span-full max-[520px]:first:border-0 max-[520px]:even:border-0">
        <span className="flex items-center gap-[7px] text-xs text-muted"><i className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: s.color }} />{s.label}</span>
        <strong className="mt-[7px] block text-[22px] font-semibold tracking-tight text-foreground tabular-nums">{number(s.value, metric === "accuracy" ? 2 : 1)}<small className="ml-[3px] text-xs font-normal text-subtle">{metric === "accuracy" ? "%" : " / 100"}</small></strong>
      </div>)}
  </div>;
}

export const dynamic = "force-dynamic";

export default async function TytDashboard() {
  const current = await requireSession();
  const exams = (await getExams()).map(exam => ({ ...calculateExam(exam), id: exam.id }));
  const latest = exams[exams.length - 1];
  const first = exams[0];
  if (!latest || !first) return <main className="min-h-screen bg-background px-5 py-16 text-left text-foreground" lang="tr"><div className="mx-auto max-w-3xl"><AccountBar admin={current.role === "admin"} /><Link href="/yks27/tyt" className="text-sm text-muted hover:underline">← TYT denemeleri</Link><h1 className="mt-8 text-2xl font-semibold">Henüz deneme kaydı yok</h1><p className="mt-3 text-muted">Yönetici ilk deneme kaydını eklediğinde grafikler burada görünecek.</p></div></main>;
  const overall = (key: "net" | "average" | "outperformed" | "index" | "accuracy" | "dps", label: string, color = "var(--chart-primary)"): Series => ({ label, color, values: exams.map(e => e[key]) });
  const bySubject = (key: "relative" | "index" | "accuracy" | "dps"): Series[] => subjects.map((s, i) => ({ label: s.label, color: s.color, values: exams.map(e => e.subjects[i][key]) }));

  const cards = [
    { label: "Son Toplam Net", value: number(latest.net), detail: "120 soru üzerinden", icon: Crosshair, featured: true },
    { label: "Son Sınav Ortalaması", value: number(latest.average), detail: "Katılımcıların net ortalaması", icon: Users },
    { label: "Geride Bırakılan %", value: `%${number(latest.outperformed)}`, detail: `${number(latest.rank, 0)}. / ${number(latest.participants, 0)} kişi`, icon: ChartNoAxesCombined },
    { label: "Performans Endeksi", value: number(latest.index), detail: "100 = sınav ortalaması", icon: Activity },
    { label: "Ortalamaya Göre Net", value: number(latest.relative, 2, true), detail: "Son sınavın ortalamasına göre", icon: ArrowUpRight },
    { label: "İlk Sınava Göre Net", value: number(difference(latest.net, first.net), 2, true), detail: `${dateLabel(first.date)} tarihinden bu yana`, icon: ArrowUpRight },
    { label: "İlk Sınava Göre Yüzdelik", value: number(difference(latest.outperformed, first.outperformed), 2, true), detail: "Yüzde puan değişimi", icon: ChartNoAxesCombined },
    { label: "Kayıt Sayısı", value: number(exams.length, 0), detail: "Kronolojik deneme kaydı", icon: Layers3 },
  ];

  return <main className="min-h-screen bg-background px-8 pt-12 pb-6 text-left text-sm text-foreground max-[900px]:px-5 max-[900px]:pt-[30px] max-[900px]:pb-5 max-[520px]:px-3 max-[520px]:pt-6 max-[520px]:pb-4" lang="tr">
    <div className="mx-auto max-w-7xl">
      <AccountBar admin={current.role === "admin"} />
      <header className="mb-[30px]">
        <Link href="/yks27/tyt" className="mb-5 inline-flex text-sm text-muted hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">← TYT denemeleri</Link>
        <div className="mb-6 flex flex-wrap items-center gap-[18px] text-xs font-medium tracking-[1.2px] text-subtle max-[520px]:gap-3"><span className="flex items-center gap-[9px] border-r border-border pr-[18px] text-xs tracking-[1px] text-muted"><BookOpen size={18} aria-hidden="true" /> TYT 2027</span><span>TYT DENEME ANALİZİ</span></div>
        <div className="flex items-center justify-between gap-5 max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-[17px]">
          <div><h1 className="text-[clamp(26px,3.5vw,39px)] leading-[1.25] font-semibold tracking-tight">TYT Gelişim Paneli<span className="text-subtle">.</span></h1><p className="mt-3 text-sm leading-relaxed text-muted max-[520px]:text-xs">Net Gelişimi · Sınav Performansı · Doğruluk · DPS</p></div>
          <div className="flex items-center gap-[9px] text-xs whitespace-nowrap text-muted"><CalendarDays size={17} aria-hidden="true" /><span>{dateLabel(first.date)} — {dateLabel(latest.date)}</span></div>
        </div>
        <div className="mt-[23px] flex flex-wrap items-center gap-[9px] text-xs text-muted"><span className="size-1.5 rounded-full bg-foreground" /><span>Son deneme <strong className="ml-[7px] font-medium text-foreground">{latest.name}</strong></span><span className="ml-1 border-l border-border pl-3">{dateLabel(latest.date)}</span></div>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3.5 min-[901px]:grid-cols-4 max-[520px]:mb-7 max-[520px]:gap-[9px]" aria-label="Son sınav özeti">{cards.map(({ label, value, detail, icon: Icon, featured }) =>
        <article className={`rounded-xl border border-border px-[22px] py-5 max-[900px]:p-[18px] max-[520px]:px-3 max-[520px]:py-[15px] ${featured ? "bg-surface-emphasis" : "bg-surface"}`} key={label}>
          <div className="flex items-center justify-between gap-1.5 text-muted"><h2 className="text-xs font-medium">{label}</h2><Icon className="shrink-0 text-subtle max-[520px]:hidden" size={17} aria-hidden="true" /></div>
          <strong className="mt-[9px] block text-[30px] leading-[1.4] font-semibold tracking-tight text-foreground tabular-nums max-[520px]:text-[26px]">{value}</strong>
          <p className="mt-1.5 text-xs leading-relaxed text-subtle">{detail}</p>
        </article>)}</section>

      <Section index="01" title="Genel Gelişim" description="Netlerinin ve genel sıralamanın zaman içindeki değişimi." icon={ChartNoAxesCombined}>
        <Chart exams={exams} title="Toplam Net ve Sınav Ortalaması" description="Her denemede senin netin ve sınavın genel ortalaması." unit=" net" series={[overall("net", "Toplam net"), overall("average", "Sınav ortalaması", "var(--chart-secondary)")]} />
        <Chart exams={exams} title="Geride Bırakılan %" description="Sınav katılımcıları arasındaki göreli konumun." unit="%" domain={[0, 100]} series={[overall("outperformed", "Geride bırakılan")]} />
      </Section>

      <Section index="02" title="Göreli Performans" description="Sınavın zorluğundan bağımsız olarak ortalamaya göre durumun." icon={Activity}>
        <Chart exams={exams} title="Performans Endeksi" description="Toplam net / sınav ortalaması × 100. 100 üzeri, ortalamanın üstü." reference={100} series={[overall("index", "Performans endeksi")]} />
        <Chart exams={exams} title="Ders Bazında Göreli Net" description="Ders netin − ders ortalaması. Pozitif değerler ortalamanın üstünde." unit=" net" reference={0} series={bySubject("relative")} />
      </Section>

      <Section index="03" title="Derslerin Gelişimi" description="Dört dersin performansını aynı ölçekte karşılaştır." icon={BookOpen}>
        <Chart exams={exams} title="Ders Performans Endeksi" description="Ders neti / ders ortalaması × 100. Kesikli çizgi her ders için sınav ortalamasını gösterir." reference={100} series={bySubject("index")} wide />
      </Section>

      <Section index="04" title="Doğruluk / Accuracy" description="İşaretlediğin soruların ne kadarını doğru yanıtladın?" icon={CheckCheck}>
        <Chart exams={exams} title="Genel Accuracy (%)" description="Doğru / (doğru + yanlış) × 100. Boş sorular dahil değildir." unit="%" domain={[0, 100]} series={[overall("accuracy", "Genel doğruluk")]} />
        <Chart exams={exams} title="Ders Bazında Accuracy (%)" description="Her dersin kendi doğru ve yanlış sayılarına göre doğruluk oranı." unit="%" domain={[0, 100]} series={bySubject("accuracy")} />
        <MetricStrip latest={latest} metric="accuracy" />
      </Section>

      <Section index="05" title="DPS / Dengeli Performans Skoru" description="Doğruluk ve işaretlenen soru oranı arasındaki denge." icon={Crosshair}>
        <Chart exams={exams} title="Genel DPS (0–100)" description="120 soru üzerinden doğruluk ve işaretleme oranının harmonik ortalaması." domain={[0, 100]} series={[overall("dps", "Genel DPS")]} />
        <Chart exams={exams} title="Ders Bazında DPS (0–100)" description="Türkçe 40 · Sosyal 20 · Matematik 40 · Fen 20 soru üzerinden." domain={[0, 100]} series={bySubject("dps")} />
        <MetricStrip latest={latest} metric="dps" />
        <p className="col-span-full px-1 text-xs leading-[1.8] text-muted">DPS = 200 × doğruluk × işaretleme oranı / (doğruluk + işaretleme oranı). Doğruluk ve işaretleme oranı 0–1 aralığında kullanılır. Net ve performans endeksi farklı ölçütlerdir.</p>
      </Section>

      <footer className="flex justify-between gap-5 pt-1 pb-2 text-xs leading-relaxed text-subtle max-[520px]:flex-col max-[520px]:gap-[7px]"><span className="font-medium text-muted">YKS 2027 <span className="mx-2 text-subtle"> / </span> TYT Gelişim Paneli</span><span>Kaynak: Deneme kayıtları · {exams.length} deneme · Son kayıt {dateLabel(latest.date)}</span></footer>
    </div>
  </main>;
}
