import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KarneTable } from "../src/app/yks27/tyt/topics/karne-table";
import { topicGroupIds, topicMetrics, topicQuery } from "../src/lib/topic-stats";
import type { VisibleGroup } from "../src/lib/topic-view";

const metrics = topicMetrics({ valid: 4, correct: 2, wrong: 1, blank: 1, cancelled: 1, exams: 2 });
const group: VisibleGroup = {
  id:"00000000-0000-0000-0000-000000000001", name:"Paragrafta anlam", subjectId:"tyt_turkish", displayOrder:1, metrics, reading:"mixed",
  topics:[{ id:"00000000-0000-0000-0000-000000000002", name:"Ana düşünce", subjectId:"tyt_turkish", groupId:"00000000-0000-0000-0000-000000000001", needsReview:false, examIds:["a","b"], counts:metrics, metrics, reading:"mixed" }],
};

test("karne default exposes group counts and real table headers without detailed metrics", () => {
  const html = renderToStaticMarkup(createElement(KarneTable,{groups:[group],detail:false,params:{},caption:"Türkçe"}));
  assert.match(html,/<table/);
  for (const label of ["Konu Adı","SS","D","Y","B","Baş. (%)"]) assert.ok(html.includes(`scope="col"`)&&html.includes(label));
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/>4<\/td>/);
  assert.match(html,/data-outcome="correct"/);
  assert.match(html,/data-outcome="incorrect"/);
  assert.doesNotMatch(html,/Denenenlerde doğruluk|Karışık sonuç|Ana düşünce/);
  assert.match(html,/aria-valuenow="50"/);
});

test("expanded detail has linked children, readings and mobile definition lists", () => {
  const html = renderToStaticMarkup(createElement(KarneTable,{groups:[group],detail:true,params:{group:group.id,view:"detail",range:"5"},caption:"Türkçe"}));
  assert.match(html,/aria-expanded="true"/);
  assert.match(html,/Ana düşünce/);
  assert.match(html,/topic=00000000-0000-0000-0000-000000000002/);
  assert.match(html,/view=detail/);
  assert.match(html,/Denenenlerde doğruluk/);
  assert.match(html,/<dl class="yks-extra-metrics"/);
  assert.match(html,/Karışık sonuç/);
  assert.match(html,/Başarıya katılmayan iptal/);
  assert.match(html,/scope="row"/);
});

test("unseen groups say Soru yok and never expose a zero-success progress bar", () => {
  const empty = topicMetrics({valid:0,correct:0,wrong:0,blank:0,cancelled:0,exams:0});
  const html = renderToStaticMarkup(createElement(KarneTable,{groups:[{...group,metrics:empty,reading:"empty",topics:[]}],detail:false,params:{},caption:"Türkçe"}));
  assert.match(html,/Soru yok/);
  assert.doesNotMatch(html,/role="progressbar"|aria-expanded=/);
});

test("shareable details retain all existing query dimensions and omit default view", () => {
  assert.equal(topicQuery({range:"5",subject:"tyt_math",q:"kök",sort:"name",topic:"topic",group:"group",view:"detail"}),"?range=5&subject=tyt_math&q=k%C3%B6k&sort=name&topic=topic&group=group&view=detail");
  assert.equal(topicQuery({range:"all",sort:"performance",view:"simple"}),"");
});

test("multiple open groups survive URL serialization and server rendering", () => {
  const second = { ...group, id: "00000000-0000-0000-0000-000000000003" };
  const ids = [group.id, second.id];
  assert.deepEqual(topicGroupIds([ids.join(","), group.id, "invalid"]), ids);
  const query = new URLSearchParams(topicQuery({ group: ids.join(","), view: "detail" }));
  assert.deepEqual(topicGroupIds(query.getAll("group")), ids);
  const html = renderToStaticMarkup(createElement(KarneTable, { groups: [group, second], detail: true, params: { group: query.get("group")! }, caption: "Türkçe" }));
  assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 2);
  assert.match(html,/>Net<\/th>/);
  assert.match(html,/>Deneme sayısı<\/th>/);
  assert.doesNotMatch(html, /Net \/ Deneme sayısı/);
});

test("an explicit empty selection overrides automatic search expansion", () => {
  const html = renderToStaticMarkup(createElement(KarneTable, { groups: [group], detail: false, params: { q: "anlam", group: "none" }, caption: "Türkçe" }));
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /Ana düşünce/);
});
