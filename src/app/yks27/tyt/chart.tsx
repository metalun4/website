"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { curveMonotoneX, line, scaleLinear, scalePoint } from "d3";
import { chartYDomain, dateLabel, number } from "./data";

export type Series = {
  label: string;
  color: string;
  values: readonly (number | null)[];
  emphasis?: "primary" | "secondary";
  curve?: "linear" | "monotone";
};
type ExamPoint = { id: string; date: string; name: string };
type Props = {
  exams: readonly ExamPoint[];
  title: string;
  description: ReactNode;
  series: readonly Series[];
  unit?: string;
  domain?: [number, number];
  reference?: number;
  referenceNote?: string;
};

const linePatterns = [undefined, "7 4", "2 4", "10 3 2 3"];
const defined = (value: number | null): value is number => value !== null && Number.isFinite(value);

function seriesPaint(series: Series, index: number) {
  if (series.emphasis === "primary") return { dash: undefined, width: 2.8, opacity: 1, radius: 4.2, activeRadius: 5.2 };
  if (series.emphasis === "secondary") return { dash: "5 4", width: 1.7, opacity: 0.62, radius: 3, activeRadius: 4.2 };
  return { dash: linePatterns[index % linePatterns.length], width: 2.6, opacity: 1, radius: 3.8, activeRadius: 5 };
}

function SeriesSwatch({ series, index }: { series: Series; index: number }) {
  const paint = seriesPaint(series, index);
  return <svg className="h-2 w-6 shrink-0" viewBox="0 0 24 8" aria-hidden="true"><line x1="1" x2="23" y1="4" y2="4" stroke={series.color} strokeDasharray={paint.dash} strokeWidth="2.5" strokeLinecap="round" strokeOpacity={paint.opacity} /></svg>;
}

export default function Chart({ exams, title, description, series, unit = "", domain, reference, referenceNote }: Props) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const node = plot.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(current => current === next ? current : next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const samples = series.flatMap(item => item.values);
  const hasPoint = samples.some(defined);
  const [y0, y1] = chartYDomain(samples, domain, reference);
  const height = width < 520 ? 196 : Math.min(360, Math.round(width * 0.32));
  const left = 52, right = 16, top = 16, bottom = 34;
  const xScale = scalePoint<number>().domain(exams.map((_, index) => index)).range([left, Math.max(left, width - right)]);
  const x = (index: number) => xScale(index) ?? left;
  const y = scaleLinear().domain([y0, y1]).range([height - bottom, top]);
  if (!domain || y0 !== domain[0] || y1 !== domain[1]) y.nice(4);
  const pathFor = (curved: boolean) => {
    const generator = line<number | null>().defined(defined).x((_, index) => x(index)).y(value => y(value as number));
    return curved ? generator.curve(curveMonotoneX) : generator;
  };
  const selected = active === null ? null : exams[active];
  const tooltipWidth = Math.min(240, width * 0.94);
  const tooltipLeft = active === null ? 0 : Math.max(0, Math.min(width - tooltipWidth, x(active) - tooltipWidth / 2));
  const labelStep = Math.max(1, Math.ceil(exams.length / Math.max(2, Math.floor((width - left - right) / 75))));
  const paintOrder = series.map((_, index) => index).sort((a, b) => (series[a].emphasis === "secondary" ? 0 : 1) - (series[b].emphasis === "secondary" ? 0 : 1));
  const formatValue = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "Veri yok" : `${number(value)}${unit}`;

  return (
    <article className="min-w-0 max-w-full rounded-[9px] border border-border bg-surface px-[18px] pt-[22px] pb-2.5 max-[520px]:px-2.5 max-[520px]:pt-[17px] max-[520px]:pb-2" aria-labelledby={id}>
      <div>
        <h3 id={id} className="text-sm font-semibold break-words">{title}</h3>
        <p id={`${id}-description`} className="mt-2 text-xs leading-5 text-muted">{description}</p>
        {referenceNote ? <p id={`${id}-reference`} className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted"><svg className="mt-1 h-2 w-6 shrink-0" viewBox="0 0 24 8" aria-hidden="true"><line className="stroke-subtle" x1="1" x2="23" y1="4" y2="4" strokeDasharray="6 5" strokeWidth="2" /></svg><span className="min-w-0">{referenceNote}</span></p> : null}
      </div>
      {series.length > 1 ? <ul className="mt-4 mb-2.5 flex list-none flex-wrap gap-x-[19px] gap-y-2.5 p-0 text-xs text-muted" aria-label="Veri serileri">{series.map((item, index) => <li className="flex min-w-0 items-center gap-1.5" key={item.label}><SeriesSwatch series={item} index={index} />{item.label}</li>)}</ul> : null}
      {!hasPoint ? <p className="mt-3 text-xs leading-5 text-muted" role="status">Bu seçim için gösterilecek veri yok.</p> : null}
      <div className={`relative min-w-0 touch-manipulation [-webkit-tap-highlight-color:transparent] ${series.length > 1 ? "" : "mt-4"}`} ref={plot} onPointerLeave={() => setActive(null)}>
        {exams.length > 0 ? <svg className="block w-full max-w-full overflow-visible" style={{ height }} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${title}. Deneme noktalarına odaklanarak değerleri inceleyebilirsiniz.`} aria-describedby={referenceNote ? `${id}-description ${id}-reference` : `${id}-description`}>
          {y.ticks(4).filter(value => reference === undefined || Math.abs(value - reference) > 1e-6).map(value => <g key={value}>
            <line className="stroke-border" x1={left} x2={width - right} y1={y(value)} y2={y(value)} strokeDasharray="3 5" />
            <text x={left - 8} y={y(value) + 4} textAnchor="end" className="fill-subtle text-[0.6875rem] tabular-nums">{number(value, Number.isInteger(value) ? 0 : 1)}{unit === "%" ? "%" : ""}</text>
          </g>)}
          {reference !== undefined ? <line className="stroke-subtle" x1={left} x2={width - right} y1={y(reference)} y2={y(reference)} strokeDasharray="6 5" /> : null}
          {active !== null ? <line className="stroke-subtle" x1={x(active)} x2={x(active)} y1={top} y2={height - bottom} /> : null}
          {paintOrder.map(index => {
            const item = series[index];
            const paint = seriesPaint(item, index);
            return <g key={item.label}>
              <path d={pathFor(item.curve === "monotone")(item.values) ?? undefined} fill="none" stroke={item.color} strokeDasharray={paint.dash} strokeWidth={paint.width} strokeOpacity={paint.opacity} strokeLinejoin="round" strokeLinecap="round" />
              {item.values.map((value, point) => defined(value) ? <circle className="fill-surface" key={exams[point]?.id ?? point} cx={x(point)} cy={y(value)} r={active === point ? paint.activeRadius : paint.radius} stroke={item.color} strokeWidth="2.3" strokeOpacity={paint.opacity} /> : null)}
            </g>;
          })}
          {exams.map((exam, index) => {
            const start = index === 0 ? left : (x(index - 1) + x(index)) / 2;
            const end = index === exams.length - 1 ? width - right : (x(index) + x(index + 1)) / 2;
            const showLabel = (index % labelStep === 0 && index < exams.length - Math.ceil(labelStep / 2)) || index === exams.length - 1;
            return <g key={exam.id}>
              {showLabel ? <text x={x(index)} y={height - 12} textAnchor="middle" className="fill-subtle text-[0.6875rem] tabular-nums">{dateLabel(exam.date).slice(0, 5)}</text> : null}
              <rect className="fill-transparent focus-visible:rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground" x={start} y={top} width={Math.max(0, end - start)} height={height - top} tabIndex={0} role="img"
                aria-label={`${exam.name}, ${dateLabel(exam.date)}. ${series.map(item => `${item.label}: ${formatValue(item.values[index])}`).join(". ")}`}
                onPointerEnter={() => setActive(index)} onPointerDown={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onKeyDown={event => { if (event.key === "Escape") { setActive(null); event.currentTarget.blur(); } }} />
            </g>;
          })}
        </svg> : null}
        {selected && active !== null ? <div className="pointer-events-none absolute top-1.5 z-2 w-[240px] max-w-[94%] rounded-lg border border-subtle bg-surface p-3 text-xs text-foreground shadow-lg shadow-foreground/10" role="status" style={{ left: tooltipLeft }}>
          <strong className="block break-words text-xs font-semibold">{selected.name}</strong><small className="mt-1 mb-2.5 block text-subtle">{dateLabel(selected.date)}</small>
          {series.map((item, index) => <div className="mt-2 flex justify-between gap-2.5" key={item.label}><span className="flex min-w-0 items-center gap-1.5 text-muted"><SeriesSwatch series={item} index={index} /><span className="break-words">{item.label}</span></span><b className="shrink-0 font-medium tabular-nums">{formatValue(item.values[active])}</b></div>)}
        </div> : null}
      </div>
      <details className="mt-2 border-t border-border text-xs">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-accent">Verileri tablo olarak göster</summary>
        <div className="max-h-80 max-w-full overflow-auto pb-3" role="region" aria-label={`${title} veri tablosu`} tabIndex={0}>
          <table className="w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead><tr><th scope="col" className="p-2">Deneme</th>{series.map(item => <th scope="col" key={item.label} className="p-2 text-right">{item.label}</th>)}</tr></thead>
            <tbody>{exams.map((exam, index) => <tr key={exam.id} className="border-t border-border"><th scope="row" className="min-w-32 p-2 font-normal"><span className="block break-words">{exam.name}</span><span className="text-subtle">{dateLabel(exam.date)}</span></th>{series.map(item => <td key={item.label} className="p-2 text-right whitespace-nowrap tabular-nums">{formatValue(item.values[index])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
