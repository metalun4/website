import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { AdvancedAnalytics } from "../src/app/yks27/tyt/analytics";
import { chartYDomain, movingAverage3, visibleSlice } from "../src/app/yks27/tyt/data";

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

test("advanced analytics starts as three single-metric sections", () => {
  const exams = [
    { id: "a", name: "Bir", date: "2026-01-01" },
    { id: "b", name: "İki", date: "2026-01-08" },
    { id: "c", name: "Üç", date: "2026-01-15" },
  ];
  const column = (values: (number | null)[]) => [values, values, values, values];
  const html = renderToStaticMarkup(createElement(AdvancedAnalytics, {
    exams,
    net: [10, 20, 30],
    trend: [null, null, 20],
    outperformed: [40, 50, 60],
    performanceIndex: [90, 100, 110],
    relative: column([1, 2, 3]),
    subjectIndex: column([80, 90, 100]),
    accuracy: [70, 80, 90],
    subjectAccuracy: column([60, 70, 80]),
    dps: [55, 65, 75],
    subjectDps: column([45, 55, 65]),
  }));
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
  assert.equal((html.match(/role="radiogroup"/g) ?? []).length, 5);
  assert.match(html, /Veri yok/);
  assert.match(html, /20,00/);
  assert.match(html, /aria-checked="true"/);
});
