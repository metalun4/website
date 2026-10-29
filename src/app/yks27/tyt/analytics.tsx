"use client";

import { useId, useState, type ReactNode } from "react";
import Chart, { type Series } from "./chart";
import { subjects } from "./data";
import { SegmentedControl } from "./segmented-control";

type Values = readonly (number | null)[];
type SubjectKey = (typeof subjects)[number]["key"];
type ExamPoint = { id: string; name: string; date: string };
type ChartView = {
  title: string;
  description: ReactNode;
  series: Series[];
  unit?: string;
  domain?: [number, number];
  reference?: number;
  referenceNote?: string;
};

const overallMetrics = [
  { value: "trend", label: "Net eğilimi" },
  { value: "outperformed", label: "Geride bırakılan" },
  { value: "index", label: "Performans endeksi" },
] as const;
const subjectMetrics = [
  { value: "relative", label: "Göreli net" },
  { value: "index", label: "Performans endeksi" },
] as const;
const accuracyMetrics = [
  { value: "accuracy", label: "Doğruluk" },
  { value: "dps", label: "DPS" },
] as const;
const subjectOptions = subjects.map(subject => ({ value: subject.key, label: subject.label }));
const scopeOptions = [{ value: "overall" as const, label: "Genel" }, ...subjectOptions];

function subjectAt(key: SubjectKey) {
  const index = subjects.findIndex(subject => subject.key === key);
  return { index: index < 0 ? 0 : index, subject: subjects[index < 0 ? 0 : index] };
}

function AnalyticsSection({ title, description, controls, children, note }: {
  title: string;
  description: string;
  controls: ReactNode;
  children: ReactNode;
  note?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className="min-w-0" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 mb-4 text-sm leading-6 text-muted">{description}</p>
      <div className="mb-4">{controls}</div>
      {children}
      {note ? <p className="mt-3 text-xs leading-5 text-muted">{note}</p> : null}
    </section>
  );
}

function OverallPerformance({ exams, net, trend, outperformed, performanceIndex }: {
  exams: readonly ExamPoint[];
  net: Values;
  trend: Values;
  outperformed: Values;
  performanceIndex: Values;
}) {
  const [metric, setMetric] = useState<(typeof overallMetrics)[number]["value"]>("trend");
  const ready = trend.some(value => value !== null && Number.isFinite(value));
  const views: Record<(typeof overallMetrics)[number]["value"], ChartView> = {
    trend: {
      title: "Net eğilimi",
      description: <>Kalın çizgi 3 denemelik hareketli ortalamadır (<span translate="no">SMA-3</span>). İnce çizgi gerçek toplam nettir. Geçerli 3 ardışık deneme yoksa ortalama boş kalır.</>,
      unit: " net",
      series: [
        { label: "3 deneme ortalaması", color: "var(--chart-primary)", values: trend, emphasis: "primary", curve: "monotone" },
        { label: "Gerçek toplam net", color: "var(--chart-secondary)", values: net, emphasis: "secondary" },
      ],
    },
    outperformed: {
      title: "Geride bırakılan katılımcı oranı",
      description: "Bu sınavın katılımcıları arasındaki konumun.",
      unit: "%",
      domain: [0, 100],
      series: [{ label: "Geride bırakılan", color: "var(--chart-primary)", values: outperformed }],
    },
    index: {
      title: "Performans endeksi",
      description: "Net / sınav ortalaması × 100.",
      reference: 100,
      referenceNote: "Kesikli çizgi sınav ortalamasını (100) gösterir.",
      series: [{ label: "Performans endeksi", color: "var(--chart-primary)", values: performanceIndex }],
    },
  };
  const view = views[metric];
  return (
    <AnalyticsSection title="Genel performans" description="Bir metrik seç. Net eğilimi son 3 denemenin ortalamasıdır; diğer metrikler o sınavın kendi sonucudur." controls={<SegmentedControl label="Metrik" value={metric} options={overallMetrics} onChange={setMetric} />}>
      {metric === "trend" && !ready ? <p className="mb-3 text-xs leading-5 text-muted" role="status">Bu aralıkta 3 ardışık geçerli net yok. Eğilim çizgisi boş kalır; gerçek netler gösterilir.</p> : null}
      <Chart exams={exams} {...view} />
    </AnalyticsSection>
  );
}

function SubjectPerformance({ exams, relative, subjectIndex }: {
  exams: readonly ExamPoint[];
  relative: readonly Values[];
  subjectIndex: readonly Values[];
}) {
  const [metric, setMetric] = useState<(typeof subjectMetrics)[number]["value"]>("relative");
  const [subjectKey, setSubjectKey] = useState<SubjectKey>(subjects[0].key);
  const { index, subject } = subjectAt(subjectKey);
  const values = (metric === "relative" ? relative : subjectIndex)[index] ?? [];
  const view: ChartView = metric === "relative"
    ? {
        title: `${subject.label} göreli net`,
        description: "Ders netin − ders ortalaması. Pozitif değer ortalamanın üstüdür.",
        unit: " net",
        reference: 0,
        referenceNote: "Kesikli çizgi sıfırdır ve sınav ortalamasını gösterir.",
        series: [{ label: "Göreli net", color: subject.color, values }],
      }
    : {
        title: `${subject.label} performans endeksi`,
        description: "Ders neti / ders ortalaması × 100.",
        reference: 100,
        referenceNote: "Kesikli çizgi sınav ortalamasını (100) gösterir.",
        series: [{ label: "Performans endeksi", color: subject.color, values }],
      };
  return (
    <AnalyticsSection
      title="Ders performansı"
      description="Bir ders ve bir metrik seç. Değerler o dersin kendi ortalamasına göredir."
      controls={<div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <SegmentedControl label="Metrik" value={metric} options={subjectMetrics} onChange={setMetric} />
        <SegmentedControl label="Ders" value={subjectKey} options={subjectOptions} onChange={setSubjectKey} />
      </div>}
    >
      <Chart exams={exams} {...view} />
    </AnalyticsSection>
  );
}

function AccuracyPerformance({ exams, accuracy, subjectAccuracy, dps, subjectDps }: {
  exams: readonly ExamPoint[];
  accuracy: Values;
  subjectAccuracy: readonly Values[];
  dps: Values;
  subjectDps: readonly Values[];
}) {
  const [metric, setMetric] = useState<(typeof accuracyMetrics)[number]["value"]>("accuracy");
  const [scope, setScope] = useState<"overall" | SubjectKey>("overall");
  const subject = scope === "overall" ? null : subjectAt(scope);
  const values = metric === "accuracy"
    ? (subject ? subjectAccuracy[subject.index] ?? [] : accuracy)
    : (subject ? subjectDps[subject.index] ?? [] : dps);
  const label = subject ? subject.subject.label : "Genel";
  const color = subject ? subject.subject.color : "var(--chart-primary)";
  const view: ChartView = metric === "accuracy"
    ? {
        title: subject ? `${label} doğruluğu` : "Genel doğruluk",
        description: subject ? "Bu dersin doğru ve yanlış sayılarına göre. Boş sorular dahil değildir." : "İşaretlediğin soruların doğru cevaplanma oranı. Boş sorular dahil değildir.",
        unit: "%",
        domain: [0, 100],
        series: [{ label: "Doğruluk", color, values }],
      }
    : {
        title: subject ? `${label} DPS` : "Genel DPS",
        description: subject ? "Bu dersin doğruluk ve işaretleme oranına göre. Resmi sınav puanı değildir." : "Doğruluk ile işaretleme oranının harmonik ortalaması. Resmi sınav puanı değildir.",
        domain: [0, 100],
        series: [{ label: "DPS", color, values }],
      };
  return (
    <AnalyticsSection
      title="Doğruluk ve DPS"
      description="Doğruluk boş soruları saymaz. DPS resmi puan değildir. Her iki metrik 0–100 ölçeğindedir."
      controls={<div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <SegmentedControl label="Metrik" value={metric} options={accuracyMetrics} onChange={setMetric} />
        <SegmentedControl label="Kapsam" value={scope} options={scopeOptions} onChange={setScope} />
      </div>}
      note="DPS = 200 × doğruluk × işaretleme oranı / (doğruluk + işaretleme oranı). Oranlar 0–1 aralığındadır. Türkçe ve matematik 40, sosyal ve fen 20 sorudur."
    >
      <Chart exams={exams} {...view} />
    </AnalyticsSection>
  );
}

export function AdvancedAnalytics({ exams, net, trend, outperformed, performanceIndex, relative, subjectIndex, accuracy, subjectAccuracy, dps, subjectDps }: {
  exams: readonly ExamPoint[];
  net: Values;
  trend: Values;
  outperformed: Values;
  performanceIndex: Values;
  relative: readonly Values[];
  subjectIndex: readonly Values[];
  accuracy: Values;
  subjectAccuracy: readonly Values[];
  dps: Values;
  subjectDps: readonly Values[];
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-8 pt-1">
      <OverallPerformance exams={exams} net={net} trend={trend} outperformed={outperformed} performanceIndex={performanceIndex} />
      <SubjectPerformance exams={exams} relative={relative} subjectIndex={subjectIndex} />
      <AccuracyPerformance exams={exams} accuracy={accuracy} subjectAccuracy={subjectAccuracy} dps={dps} subjectDps={subjectDps} />
    </div>
  );
}
