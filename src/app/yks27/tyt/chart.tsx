"use client";

import { useEffect, useId, useRef, useState } from "react";
import { extent, line, scaleLinear, scalePoint } from "d3";
import { dateLabel, number } from "./data";

export type Series = { label: string; color: string; values: (number | null)[] };
type Props = { exams: { id: string; date: string; name: string }[]; title: string; description: string; series: Series[]; unit?: string; domain?: [number, number]; reference?: number; wide?: boolean };

export default function Chart({ exams, title, description, series, unit = "", domain, reference, wide }: Props) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    if (!plot.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(plot.current);
    return () => observer.disconnect();
  }, []);
  const values = series.flatMap(s => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
  if (reference !== undefined) values.push(reference);
  const [low = 0, high = 1] = extent(values);
  const padding = Math.max((high - low) * 0.1, 1);
  const height = 254;
  const left = 48, right = 22, top = 24, bottom = 38;
  const xScale = scalePoint<number>().domain(exams.map((_, i) => i)).range([left, width - right]);
  const x = (i: number) => xScale(i) ?? left;
  const y = scaleLinear().domain(domain ?? [low - padding, high + padding]).range([height - bottom, top]);
  if (!domain) y.nice(4);
  const path = line<number | null>()
    .defined(value => value !== null && Number.isFinite(value))
    .x((_, i) => x(i))
    .y(value => y(value!));
  const selected = active === null ? null : exams[active];
  const tooltipWidth = Math.min(240, width * 0.94);
  const tooltipLeft = active === null ? 0 : Math.max(0, Math.min(width - tooltipWidth, x(active) - tooltipWidth / 2));
  const labelStep = Math.max(1, Math.ceil(exams.length / Math.max(2, Math.floor((width - left - right) / 75))));

  return (
    <article className={`min-w-0 rounded-[9px] border border-border bg-surface px-[18px] pt-[22px] pb-2.5 max-[520px]:px-2.5 max-[520px]:pt-[17px] max-[520px]:pb-2 ${wide ? "col-span-full" : ""}`} aria-labelledby={id}>
      <div><h3 id={id} className="text-sm font-semibold">{title}</h3><p className="mt-2 min-h-[17px] text-xs leading-[1.7] text-muted">{description}</p></div>
      <ul className="mt-[18px] mb-2.5 flex list-none flex-wrap gap-x-[19px] gap-y-2.5 p-0 text-xs text-muted" aria-label="Veri serileri">{series.map(s => <li className="flex items-center gap-1.5" key={s.label}>
        <svg className="h-2 w-6 shrink-0" viewBox="0 0 24 8" aria-hidden="true"><line x1="1" x2="23" y1="4" y2="4" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" /></svg>{s.label}
      </li>)}</ul>
      <div className="relative" ref={plot} onPointerLeave={() => setActive(null)}>
        <svg className="block h-[254px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${title}. Deneme noktalarına odaklanarak değerleri inceleyebilirsiniz.`}>
          {y.ticks(4).map(value => <g key={value}>
            <line className="stroke-border" x1={left} x2={width - right} y1={y(value)} y2={y(value)} strokeDasharray="3 5" />
            <text x={left - 10} y={y(value) + 4} textAnchor="end" className="fill-subtle text-[11px]">{number(value, Number.isInteger(value) ? 0 : 1)}{unit === "%" ? "%" : ""}</text>
          </g>)}
          {reference !== undefined && <g><line className="stroke-subtle" x1={left} x2={width - right} y1={y(reference)} y2={y(reference)} strokeDasharray="6 5" /><text x={width - right} y={y(reference) - 7} textAnchor="end" className="fill-muted text-[11px]">Ortalama · {reference}</text></g>}
          {active !== null && <line className="stroke-subtle" x1={x(active)} x2={x(active)} y1={top} y2={height - bottom} />}
          {series.map(s => <g key={s.label}>
            <path d={path(s.values) ?? undefined} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => v === null || !Number.isFinite(v) ? null : <circle className="fill-surface" key={i} cx={x(i)} cy={y(v)} r={active === i ? 5 : 3.8} stroke={s.color} strokeWidth="2.3" />)}
          </g>)}
          {exams.map((exam, i) => {
            const start = i === 0 ? left : (x(i - 1) + x(i)) / 2;
            const end = i === exams.length - 1 ? width - right : (x(i) + x(i + 1)) / 2;
            return <g key={exam.id}>
            {(i % labelStep === 0 && i < exams.length - Math.ceil(labelStep / 2) || i === exams.length - 1) && <text x={x(i)} y={height - 12} textAnchor="middle" className="fill-subtle text-[11px]">{dateLabel(exam.date).slice(0, 5)}</text>}
            <rect className="fill-transparent focus-visible:rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground" x={start} y={top} width={end - start} height={height - top} tabIndex={0} role="img"
              aria-label={`${exam.name}, ${dateLabel(exam.date)}. ${series.map(s => `${s.label}: ${number(s.values[i])}${s.values[i] === null ? "" : unit}`).join(". ")}`}
              onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onKeyDown={event => { if (event.key === "Escape") setActive(null); }} />
          </g>; })}
        </svg>
        {selected && active !== null && <div className="pointer-events-none absolute top-1.5 z-2 w-[240px] max-w-[94%] rounded-lg border border-subtle bg-surface p-3 text-xs text-foreground shadow-lg shadow-foreground/10" role="status" style={{ left: tooltipLeft }}>
          <strong className="block break-words text-xs font-semibold">{selected.name}</strong><small className="mt-1 mb-2.5 block text-subtle">{dateLabel(selected.date)}</small>
          {series.map(s => <div className="mt-2 flex justify-between gap-2.5" key={s.label}><span className="flex items-center gap-1.5 text-muted"><svg className="h-2 w-6 shrink-0" viewBox="0 0 24 8" aria-hidden="true"><line x1="1" x2="23" y1="4" y2="4" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" /></svg>{s.label}</span><b className="shrink-0 font-medium tabular-nums">{number(s.values[active])}{s.values[active] === null ? "" : unit}</b></div>)}
        </div>}
      </div>
      <details className="mt-2 border-t border-border text-xs">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-accent">Verileri tablo olarak göster</summary>
        <div className="max-h-80 overflow-auto pb-3" role="region" aria-label={`${title} veri tablosu`} tabIndex={0}>
          <table className="w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead><tr><th scope="col" className="p-2">Deneme</th>{series.map(s => <th scope="col" key={s.label} className="p-2 text-right">{s.label}</th>)}</tr></thead>
            <tbody>{exams.map((exam, i) => <tr key={exam.id} className="border-t border-border"><th scope="row" className="min-w-32 p-2 font-normal"><span className="block break-words">{exam.name}</span><span className="text-subtle">{dateLabel(exam.date)}</span></th>{series.map(s => <td key={s.label} className="p-2 text-right whitespace-nowrap tabular-nums">{number(s.values[i])}{s.values[i] == null ? "" : unit}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
