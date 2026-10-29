"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { chartModel, chartValue, seriesPaint, type ChartModel, type ChartExam, type Series } from "./chart-model";
import { dateLabel } from "./data";

export type { Series };

const ChartGeometry = memo(function ChartGeometry({ model, onPoint }: {
  model: ChartModel;
  onPoint: (id: string, event: ReactPointerEvent<SVGRectElement>) => void;
}) {
  return <g>
    <g pointerEvents="none">
      {model.ticks.map(tick => <g key={`${tick.value}`}>
        {tick.grid ? <line className="stroke-border" x1={model.left} x2={model.width - model.right} y1={tick.y} y2={tick.y} strokeDasharray="3 5" /> : null}
        <text x={model.left - 8} y={tick.y + 4} textAnchor="end" className="fill-subtle text-[0.6875rem] tabular-nums">{tick.label}</text>
      </g>)}
      {model.referenceY !== null ? <line className="stroke-subtle" x1={model.left} x2={model.width - model.right} y1={model.referenceY} y2={model.referenceY} strokeDasharray="6 5" /> : null}
      {model.series.map(item => <g key={item.label}>
        {item.d ? <path d={item.d} fill="none" stroke={item.color} strokeDasharray={item.dash} strokeWidth={item.width} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {item.points.map(point => <circle className="fill-surface" key={point.examId} cx={point.cx} cy={point.cy} r={item.radius} stroke={item.color} strokeWidth="2.3" />)}
      </g>)}
      {model.columns.map(column => column.axisLabel ? <text key={`${column.id}-label`} x={column.x} y={model.height - 12} textAnchor={column.axisAnchor} className="fill-subtle text-[0.6875rem] tabular-nums">{column.axisLabel}</text> : null)}
    </g>
    {model.columns.map(column => <rect key={column.id} className="fill-transparent" x={column.start} y={model.top} width={Math.max(0, column.end - column.start)} height={model.height - model.top} onPointerEnter={event => onPoint(column.id, event)} onPointerDown={event => onPoint(column.id, event)} />)}
  </g>;
});

const ChartTable = memo(function ChartTable({ title, exams, series, unit }: {
  title: string;
  exams: readonly ChartExam[];
  series: readonly Series[];
  unit: string;
}) {
  return <details className="mt-2 border-t border-border text-xs">
    <summary className="flex min-h-11 cursor-pointer items-center font-medium text-accent">Verileri tablo olarak göster</summary>
    <div className="max-h-80 max-w-full overflow-auto pb-3" role="region" aria-label={`${title} veri tablosu`} tabIndex={0}>
      <table className="w-full text-left">
        <caption className="sr-only">{title}</caption>
        <thead><tr><th scope="col" className="p-2">Deneme</th>{series.map(item => <th scope="col" key={item.label} className="p-2 text-right">{item.label}</th>)}</tr></thead>
        <tbody>{exams.map((exam, index) => <tr key={exam.id} className="border-t border-border">
          <th scope="row" className="min-w-32 p-2 font-normal"><Link href={`/yks27/tyt/${exam.id}`} prefetch={false} className="block break-words hover:underline">{exam.name}</Link><span className="text-subtle">{dateLabel(exam.date)}</span></th>
          {series.map(item => <td key={item.label} className="p-2 text-right whitespace-nowrap tabular-nums">{chartValue(item.values[index], unit)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </details>;
});

export default function Chart({ exams, title, description, series, unit = "", domain, reference, referenceNote }: {
  exams: readonly ChartExam[];
  title: string;
  description: ReactNode;
  series: readonly Series[];
  unit?: string;
  domain?: readonly [number, number];
  reference?: number;
  referenceNote?: string;
}) {
  const id = useId();
  const plot = useRef<HTMLDivElement>(null);
  const pointerInside = useRef(false);
  const touchAt = useRef(0);
  const [width, setWidth] = useState(560);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const model = useMemo(() => chartModel({ exams, series, width, unit, domain, reference }), [exams, series, width, unit, domain, reference]);
  const active = model.columns.find(column => column.id === activeId) ?? null;
  const activeIndex = active ? model.columns.indexOf(active) : -1;

  useLayoutEffect(() => {
    const node = plot.current;
    if (!node) return;
    const apply = (raw: number) => {
      const next = Math.round(raw / 8) * 8;
      if (next > 0) setWidth(current => current === next ? current : next);
    };
    apply(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => apply(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const onDown = (event: PointerEvent) => {
      if (!plot.current?.contains(event.target as Node)) {
        setActiveId(null);
        setAnnouncement("");
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [activeId]);

  const onPoint = useCallback((pointId: string, event: ReactPointerEvent<SVGRectElement>) => {
    if (event.pointerType === "touch") {
      if (event.type !== "pointerdown") return;
      touchAt.current = Date.now();
      setAnnouncement("");
      setActiveId(current => current === pointId ? null : pointId);
      return;
    }
    if (Date.now() - touchAt.current < 700) return;
    setAnnouncement("");
    setActiveId(pointId);
  }, []);

  const clearIfIdle = () => {
    const focusInside = !!plot.current?.contains(document.activeElement);
    if (!pointerInside.current && !focusInside && Date.now() - touchAt.current >= 700) {
      setActiveId(null);
      setAnnouncement("");
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const columns = model.columns;
    if (!columns.length) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (activeId) {
        setActiveId(null);
        setAnnouncement("");
      } else event.currentTarget.blur();
      return;
    }
    if (event.key === "Enter" && active) {
      event.preventDefault();
      plot.current?.querySelector<HTMLAnchorElement>(`a[href="/yks27/tyt/${CSS.escape(active.id)}"]`)?.click();
      return;
    }
    const index = columns.findIndex(column => column.id === activeId);
    let next = -1;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = columns.length - 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % columns.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index < 0 ? columns.length - 1 : (index - 1 + columns.length) % columns.length;
    else return;
    event.preventDefault();
    setActiveId(columns[next].id);
    setAnnouncement(columns[next].summary);
  };

  const describedBy = referenceNote ? `${id}-description ${id}-reference` : `${id}-description`;
  const tooltipWidth = Math.min(240, model.width * 0.94);

  return <article className="min-w-0 max-w-full rounded-[9px] border border-border bg-surface px-[18px] pt-[22px] pb-2.5 max-[520px]:px-2.5 max-[520px]:pt-[17px] max-[520px]:pb-2" aria-labelledby={id}>
    <div>
      <h3 id={id} className="text-sm font-semibold break-words">{title}</h3>
      <p id={`${id}-description`} className="mt-2 text-xs leading-5 text-muted">{description}</p>
      {referenceNote ? <p id={`${id}-reference`} className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted"><svg className="mt-1 h-2 w-6 shrink-0" viewBox="0 0 24 8" aria-hidden="true"><line className="stroke-subtle" x1="1" x2="23" y1="4" y2="4" strokeDasharray="6 5" strokeWidth="2" /></svg><span className="min-w-0">{referenceNote}</span></p> : null}
    </div>
    {series.length > 1 ? <ul className="mt-4 mb-2.5 flex list-none flex-wrap gap-x-[19px] gap-y-2.5 p-0 text-xs text-muted" aria-label="Veri serileri">{series.map((item, index) => <li className="flex min-w-0 items-center gap-1.5" key={item.label}><SeriesSwatch series={item} index={index} />{item.label}</li>)}</ul> : null}
    {!model.hasPoint ? <p className="mt-3 text-xs leading-5 text-muted" role="status">Bu seçim için gösterilecek veri yok.</p> : null}
    <div
      ref={plot}
      tabIndex={exams.length ? 0 : undefined}
      role="group"
      aria-label={`${title}. Ok tuşlarıyla deneme seçin. Enter seçili denemenin raporunu açar.`}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      onPointerEnter={() => { pointerInside.current = true; }}
      onPointerLeave={event => { pointerInside.current = false; if (event.pointerType === "touch") return; clearIfIdle(); }}
      onBlur={event => { if (event.relatedTarget instanceof Node && plot.current?.contains(event.relatedTarget)) return; clearIfIdle(); }}
      className={`relative min-w-0 touch-manipulation rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground [-webkit-tap-highlight-color:transparent] ${series.length > 1 ? "" : "mt-4"}`}
    >
      {exams.length > 0 ? <svg className="block w-full max-w-full overflow-visible" style={{ height: model.height }} viewBox={`0 0 ${model.width} ${model.height}`} aria-hidden="true">
        <ChartGeometry model={model} onPoint={onPoint} />
        {active ? <g pointerEvents="none">
          <line className="stroke-subtle" x1={active.x} x2={active.x} y1={model.top} y2={model.height - model.bottom} />
          {model.series.map(item => {
            const point = item.points.find(candidate => candidate.examId === active.id);
            return point ? <circle className="fill-surface" key={item.label} cx={point.cx} cy={point.cy} r={item.radius + 1.2} stroke={item.color} strokeWidth="2.6" /> : null;
          })}
        </g> : null}
      </svg> : null}
      {active ? <div className="pointer-events-none absolute top-1.5 z-2 max-w-[94%] rounded-lg border border-subtle bg-surface p-3 text-xs text-foreground shadow-lg shadow-foreground/10" aria-hidden="true" style={{ left: `clamp(0px, calc(${(active.x / model.width) * 100}% - ${tooltipWidth / 2}px), calc(100% - ${tooltipWidth}px))`, width: tooltipWidth }}>
        <Link href={`/yks27/tyt/${active.id}`} prefetch={false} tabIndex={-1} className="pointer-events-auto block break-words text-xs font-semibold hover:underline">{active.name}</Link>
        <small className="mt-1 mb-2.5 block text-subtle">{active.dateText}</small>
        {series.map((item, index) => <div className="mt-2 flex justify-between gap-2.5" key={item.label}><span className="flex min-w-0 items-center gap-1.5 text-muted"><SeriesSwatch series={item} index={index} /><span className="break-words">{item.label}</span></span><b className="shrink-0 font-medium tabular-nums">{chartValue(item.values[activeIndex], unit)}</b></div>)}
      </div> : null}
    </div>
    <p className="sr-only" aria-live="polite">{active ? announcement : ""}</p>
    <ChartTable title={title} exams={exams} series={series} unit={unit} />
  </article>;
}

function SeriesSwatch({ series, index }: { series: Series; index: number }) {
  const paint = seriesPaint(series, index);
  return <svg className="h-2 w-6 shrink-0" viewBox="0 0 24 8" aria-hidden="true"><line x1="1" x2="23" y1="4" y2="4" stroke={series.color} strokeDasharray={paint.dash} strokeWidth="2.5" strokeLinecap="round" /></svg>;
}
