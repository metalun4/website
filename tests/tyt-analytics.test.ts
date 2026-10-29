import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { AdvancedAnalytics, type AnalyticsExam } from "@/app/yks27/tyt/analytics";
import { chartModel, chartScaleDomain } from "@/app/yks27/tyt/chart-model";
import { chartYDomain, movingAverage3, visibleSlice } from "@/app/yks27/tyt/data";

test("SMA-3 waits for three consecutive finite results and never treats gaps as zero", () => {
  assert.deepEqual(movingAverage3([]), []);
  assert.deepEqual(movingAverage3([5]), [null]);
  assert.deepEqual(movingAverage3([5, 8]), [null, null]);
  assert.deepEqual(movingAverage3([1, 2, 3]), [null, null, 2]);
  assert.deepEqual(movingAverage3([null, null, null]), [null, null, null]);
  assert.deepEqual(movingAverage3([10, null, 30, 40, 50]), [null, null, null, null, 40]);
  assert.deepEqual(movingAverage3([1, 2, Number.NaN]), [null, null, null]);
  assert.equal(movingAverage3([1, 2, Number.POSITIVE_INFINITY])[2], null);
  assert.equal(movingAverage3([-3, -1, 2])[2], (-3 + -1 + 2) / 3);
});

test("the date window does not change an exam's SMA-3", () => {
  const nets = [1, 2, 3, 4, 5, 6, 7];
  const trend = visibleSlice(movingAverage3(nets), "5");
  assert.deepEqual(visibleSlice(nets, "5"), [3, 4, 5, 6, 7]);
  assert.deepEqual(trend, [2, 3, 4, 5, 6]);
  assert.notDeepEqual(movingAverage3(visibleSlice(nets, "5")), trend);
  assert.equal(movingAverage3(visibleSlice(nets, "5"))[0], null);
  assert.deepEqual(visibleSlice(movingAverage3(nets), "all"), movingAverage3(nets));
});

test("chart domains keep a fitting fixed scale and expand instead of clipping", () => {
  assert.deepEqual(chartYDomain([0, 100, null], [0, 100]), [0, 100]);
  assert.deepEqual(chartYDomain([25, 80], [0, 100], 100), [0, 100]);
  const above = chartYDomain([10, 110], [0, 100]);
  assert.equal(above[0], 0);
  assert.ok(above[1] >= 110);
  const below = chartYDomain([-5, 50], [0, 100]);
  assert.ok(below[0] <= -5);
  assert.equal(below[1], 100);
  const around = chartYDomain([null, 40]);
  assert.ok(around[0] > 30);
  assert.ok(around[1] < 50);
  const withReference = chartYDomain([130, 150], undefined, 100);
  assert.ok(withReference[0] <= 100);
  assert.ok(withReference[1] >= 150);
  assert.deepEqual(chartYDomain([null, null], [0, 100]), [0, 100]);
});

function analyticsExams(): AnalyticsExam[] {
  const subject = (relative: number, index: number, accuracy: number, dps: number) => ({ relative, index, accuracy, dps });
  return [
    { id: "a", name: "Bir", date: "2026-01-01", net: 10, trend: null, outperformed: 40, index: 90, accuracy: 70, dps: 55, subjects: Array.from({ length: 4 }, () => subject(1, 80, 60, 45)) },
    { id: "b", name: "İki", date: "2026-01-08", net: 20, trend: null, outperformed: 50, index: 100, accuracy: 80, dps: 65, subjects: Array.from({ length: 4 }, () => subject(2, 90, 70, 55)) },
    { id: "c", name: "Üç", date: "2026-01-15", net: 30, trend: 20, outperformed: 60, index: 110, accuracy: 90, dps: 75, subjects: Array.from({ length: 4 }, () => subject(3, 100, 80, 65)) },
  ];
}

test("advanced analytics starts as three single-metric sections", () => {
  const html = renderToStaticMarkup(createElement(AdvancedAnalytics, { exams: analyticsExams() }));
  assert.match(html, /Genel performans/);
  assert.match(html, /Ders performansı/);
  assert.match(html, /Doğruluk ve DPS/);
  assert.match(html, /Net eğilimi/);
  assert.match(html, /SMA-3/);
  assert.match(html, /3 deneme ortalaması/);
  assert.match(html, /Gerçek toplam net/);
  assert.match(html, /Türkçe göreli net/);
  assert.equal(html.includes("Sosyal göreli net"), false);
  assert.match(html, /Genel doğruluk/);
  assert.equal(html.includes("lg:grid-cols-2"), false);
  assert.equal(html.includes("pencereden önceki denemeleri"), false);
  assert.equal((html.match(/role="radiogroup"/g) ?? []).length, 5);
  assert.match(html, /Veri yok/);
  assert.match(html, /20,00/);
  assert.match(html, /aria-checked="true"/);
  assert.match(html, /href="\/yks27\/tyt\/b"/);
  const rects = html.match(/<rect\b[^>]*>/g) ?? [];
  assert.ok(rects.length > 0);
  assert.ok(rects.every(rect => !rect.includes("tabindex")));
  assert.equal(html.includes('stroke-opacity="0.62"'), false);
});

test("a shortened window says the moving average still uses earlier exams", () => {
  const html = renderToStaticMarkup(createElement(AdvancedAnalytics, { exams: analyticsExams(), trendIncludesHidden: true }));
  assert.match(html, /pencereden önceki denemeleri/);
});

test("subject scales stay put when one subject is only part of the data", () => {
  const shared = chartScaleDomain([1, 2, 3, 30], undefined, 0);
  assert.deepEqual(chartScaleDomain([1, 2, 3], shared, 0), shared);
});

test("chart axes keep the reference label, inset markers, and show the year only when needed", () => {
  const sameYear = chartModel({
    exams: [
      { id: "a", name: "A", date: "2026-01-01" },
      { id: "b", name: "B", date: "2026-02-01" },
    ],
    series: [{ label: "Net", color: "red", values: [10, 20] }],
    width: 640,
    unit: " net",
  });
  assert.ok(sameYear.columns[0].x > sameYear.left);
  assert.ok(sameYear.columns[1].x < sameYear.width - sameYear.right);
  assert.ok(sameYear.ticks.every(tick => tick.label.endsWith(" net") && tick.label.includes(",")));
  assert.ok(sameYear.columns.every(column => !column.axisLabel?.includes("2026")));

  const crossed = chartModel({
    exams: [
      { id: "a", name: "A", date: "2025-09-01" },
      { id: "b", name: "B", date: "2026-06-01" },
    ],
    series: [{ label: "Net", color: "red", values: [10, 20] }],
    width: 640,
  });
  assert.ok(crossed.columns.some(column => column.axisLabel?.includes("2025")));
  assert.ok(crossed.columns.some(column => column.axisLabel?.includes("2026")));

  const referenced = chartModel({
    exams: [
      { id: "a", name: "A", date: "2026-01-01" },
      { id: "b", name: "B", date: "2026-02-01" },
    ],
    series: [{ label: "Doğruluk", color: "red", values: [0, 100] }],
    width: 640,
    domain: [0, 100],
    reference: 0,
    unit: "%",
  });
  const referenceTick = referenced.ticks.find(tick => tick.value === 0);
  assert.equal(referenceTick?.grid, false);
  assert.match(referenceTick?.label ?? "", /0,00%/);
  const ys = referenced.series[0].points.map(point => point.cy);
  assert.ok(Math.min(...ys) > referenced.top);
  assert.ok(Math.max(...ys) < referenced.height - referenced.bottom);
});
