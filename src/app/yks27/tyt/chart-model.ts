import { scaleLinear, scalePoint } from "d3-scale";
import { curveMonotoneX, line as lineGenerator } from "d3-shape";
import { chartYDomain, dateLabel, number } from "./data";

export type Series = {
  label: string;
  color: string;
  values: readonly (number | null)[];
  emphasis?: "primary" | "secondary";
  curve?: "linear" | "monotone";
};

export type ChartExam = { id: string; name: string; date: string };

export type ChartTick = { value: number; y: number; label: string; grid: boolean };
export type ChartPoint = { examId: string; cx: number; cy: number };
export type ChartSeriesDraw = {
  label: string;
  color: string;
  dash?: string;
  width: number;
  radius: number;
  d: string | null;
  points: ChartPoint[];
};
export type ChartColumn = {
  id: string;
  name: string;
  dateText: string;
  x: number;
  start: number;
  end: number;
  axisLabel: string | null;
  axisAnchor: "start" | "middle" | "end";
  summary: string;
};
export type ChartModel = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  hasPoint: boolean;
  ticks: ChartTick[];
  referenceY: number | null;
  series: ChartSeriesDraw[];
  columns: ChartColumn[];
};

const linePatterns = [undefined, "7 4", "2 4", "10 3 2 3"];
const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

export function chartValue(value: number | null | undefined, unit = "") {
  return finite(value) ? `${number(value, 2)}${unit}` : "Veri yok";
}

/** Pads and rounds the axis unless a fixed domain already contains the data. */
export function chartScaleDomain(samples: readonly (number | null)[], fixed?: readonly [number, number], reference?: number): [number, number] {
  const [y0, y1] = chartYDomain(samples, fixed, reference);
  if (fixed && y0 === fixed[0] && y1 === fixed[1]) return [y0, y1];
  const [low, high] = scaleLinear().domain([y0, y1]).nice(4).domain();
  return [low, high];
}

export function seriesPaint(series: Series, index: number) {
  if (series.emphasis === "primary") return { dash: undefined, width: 3.2, radius: 4.2 };
  if (series.emphasis === "secondary") return { dash: "7 4", width: 2.4, radius: 3.6 };
  return { dash: linePatterns[index % linePatterns.length], width: 2.6, radius: 3.8 };
}

function textWidth(label: string) {
  return Math.ceil(label.length * 11 * 0.62);
}

function axisAnchor(x: number, label: string, width: number): "start" | "middle" | "end" {
  const half = textWidth(label) / 2;
  if (x - half < 2) return "start";
  if (x + half > width - 2) return "end";
  return "middle";
}

export function chartModel({ exams, series, width, unit = "", domain, reference }: {
  exams: readonly ChartExam[];
  series: readonly Series[];
  width: number;
  unit?: string;
  domain?: readonly [number, number];
  reference?: number;
}): ChartModel {
  const top = 16;
  const right = 16;
  const bottom = 34;
  const height = width < 520 ? 196 : Math.min(360, Math.round(width * 0.32));
  const inset = 8;
  const samples = series.flatMap(item => item.values);
  const hasPoint = samples.some(finite);
  const [y0, y1] = chartScaleDomain(samples, domain, reference);
  const yScale = scaleLinear().domain([y0, y1]).range([height - bottom - inset, top + inset]);
  const y = (value: number) => yScale(value);
  let tickValues = yScale.ticks(4);
  if (finite(reference)) {
    const referenceY = y(reference);
    tickValues = tickValues.filter(value => Math.abs(y(value) - referenceY) > 16);
    tickValues.push(reference);
    tickValues.sort((a, b) => a - b);
  }
  const ticks = tickValues.map(value => ({
    value,
    y: y(value),
    label: chartValue(value, unit),
    grid: !finite(reference) || Math.abs(value - reference) > 1e-6,
  }));
  const labelWidth = ticks.reduce((max, tick) => Math.max(max, textWidth(tick.label)), 0);
  const left = Math.min(Math.max(52, labelWidth + 12), Math.max(52, (width - right) * 0.46));
  const showYear = new Set(exams.map(exam => exam.date.slice(0, 4))).size > 1;
  const labelBudget = showYear ? 96 : 72;
  const plotWidth = Math.max(1, width - left - right);
  const labelStep = Math.max(1, Math.ceil(exams.length / Math.max(2, Math.floor(plotWidth / labelBudget))));
  const xScale = scalePoint<number>()
    .domain(exams.map((_, index) => index))
    .range([left, Math.max(left + 1, width - right)])
    .padding(0.5);
  const x = (index: number) => xScale(index) ?? left;
  const paintOrder = series.map((_, index) => index).sort((a, b) => (series[a].emphasis === "secondary" ? 0 : 1) - (series[b].emphasis === "secondary" ? 0 : 1));
  const drawn = paintOrder.map(index => {
    const item = series[index];
    const paint = seriesPaint(item, index);
    const values = exams.map((_, point) => finite(item.values[point]) ? item.values[point] : null);
    const generator = lineGenerator<number | null>().defined(finite).x((_, point) => x(point)).y(value => y(value as number));
    const path = (item.curve === "monotone" ? generator.curve(curveMonotoneX) : generator)(values);
    return {
      label: item.label,
      color: item.color,
      dash: paint.dash,
      width: paint.width,
      radius: paint.radius,
      d: path,
      points: values.flatMap((value, point) => finite(value) && exams[point] ? [{ examId: exams[point].id, cx: x(point), cy: y(value) }] : []),
    };
  });
  const columns = exams.map((exam, index) => {
    const start = index === 0 ? left : (x(index - 1) + x(index)) / 2;
    const end = index === exams.length - 1 ? width - right : (x(index) + x(index + 1)) / 2;
    const showLabel = exams.length === 1 || (index % labelStep === 0 && index < exams.length - Math.ceil(labelStep / 2)) || index === exams.length - 1;
    const fullDate = dateLabel(exam.date);
    const axisLabel = showLabel ? (showYear ? fullDate : fullDate.slice(0, 5)) : null;
    const summary = `${exam.name}, ${fullDate}. ${series.map(item => `${item.label}: ${chartValue(item.values[index], unit)}`).join(". ")}`;
    return {
      id: exam.id,
      name: exam.name,
      dateText: fullDate,
      x: x(index),
      start,
      end,
      axisLabel,
      axisAnchor: axisLabel ? axisAnchor(x(index), axisLabel, width) : "middle" as const,
      summary,
    };
  });
  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    hasPoint,
    ticks,
    referenceY: finite(reference) ? y(reference) : null,
    series: drawn,
    columns,
  };
}
