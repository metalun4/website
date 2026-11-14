"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { readingLabels, topicGroupIds, topicQuery, type TopicMetrics, type PerformanceReading } from "@/lib/topic-stats";
import { useGroupState } from "./group-state";
import type { VisibleGroup, VisibleTopic } from "@/lib/topic-view";
import { number, formatPercent } from "../data";

type ViewParams = Parameters<typeof topicQuery>[0];
const rate = (value: number | null) => value === null ? "—" : formatPercent(value);

function Success({ metrics }: { metrics: TopicMetrics }) {
  if (metrics.success === null) return <span>Soru yok</span>;
  return <div className="yks-success"><Progress value={metrics.success * 100} aria-label={`Başarı ${rate(metrics.success)}`} /><span>{number(metrics.success * 100, 0)}</span></div>;
}
function Cells({ metrics, reading, detail }: { metrics: TopicMetrics; reading: PerformanceReading; detail: boolean }) {
  return <><TableCell>{metrics.valid}</TableCell><TableCell data-outcome="correct">{metrics.correct}</TableCell><TableCell data-outcome="incorrect">{metrics.wrong}</TableCell><TableCell>{metrics.blank}</TableCell><TableCell><Success metrics={metrics} /></TableCell>{detail ? <><TableCell className="yks-extra-col">{rate(metrics.attempt)}</TableCell><TableCell className="yks-extra-col">{rate(metrics.accuracy)}</TableCell><TableCell className="yks-extra-col">{number(metrics.net)}</TableCell><TableCell className="yks-extra-col">{metrics.exams}</TableCell><TableCell className="yks-extra-col"><Badge variant="outline">{readingLabels[reading]}</Badge></TableCell></> : null}</>;
}
export function ExtraMetrics({ metrics, reading }: { metrics: TopicMetrics; reading: PerformanceReading }) {
  return <dl className="yks-extra-metrics">
    <div><dt>Deneme oranı</dt><dd>{rate(metrics.attempt)}</dd></div><div><dt>Denenenlerde doğruluk</dt><dd>{rate(metrics.accuracy)}</dd></div>
    <div><dt>Net</dt><dd>{number(metrics.net)}</dd></div><div><dt>Deneme sayısı</dt><dd>{metrics.exams}</dd></div>
    <div><dt className="sr-only">Performans</dt><dd><Badge variant="outline">{readingLabels[reading]}</Badge></dd></div>
    {metrics.cancelled ? <div><dt>Başarıya katılmayan iptal</dt><dd>{metrics.cancelled}</dd></div> : null}
  </dl>;
}
function TopicRows({ topic, detail, params }: { topic: VisibleTopic; detail: boolean; params: ViewParams }) {
  return <><TableRow className="yks-child-row"><TableHead scope="row"><Link href={`/yks27/tyt/topics${topicQuery({ ...params, topic: topic.id })}#konu-detayi`} className="hover:text-accent hover:underline">{topic.name}</Link>{topic.needsReview ? <span className="block text-xs text-muted">Konu adı inceleme bekliyor</span> : null}</TableHead><Cells metrics={topic.metrics} reading={topic.reading} detail={detail} /></TableRow>{detail ? <TableRow className="yks-detail-row yks-child-row"><TableCell colSpan={6}><ExtraMetrics metrics={topic.metrics} reading={topic.reading} /></TableCell></TableRow> : null}</>;
}
function GroupRows({ group, detail, params }: { group: VisibleGroup; detail: boolean; params: ViewParams }) {
  const state = useGroupState();
  const open = params.group ? topicGroupIds(params.group).includes(group.id) : Boolean(params.q);
  return <Collapsible asChild open={open} onOpenChange={value => state?.toggle(group.id, value)}><TableBody id={`grup-${group.id}`}>
    <TableRow className={group.metrics.valid ? undefined : "yks-empty-row"}><TableHead scope="row">{group.topics.length ? <CollapsibleTrigger className="yks-row-toggle" aria-label={`${group.name}: alt konular`}><ChevronRight aria-hidden="true" /><span>{group.name}</span></CollapsibleTrigger> : <span>{group.name}</span>}</TableHead><Cells metrics={group.metrics} reading={group.reading} detail={detail} /></TableRow>
    {detail ? <TableRow className="yks-detail-row"><TableCell colSpan={6}><ExtraMetrics metrics={group.metrics} reading={group.reading} /></TableCell></TableRow> : null}
    {group.topics.map(topic => <Fragment key={topic.id}><CollapsibleContent asChild><TopicRowBundle topic={topic} detail={detail} params={params} /></CollapsibleContent>{detail ? <CollapsibleContent asChild><TableRow className="yks-detail-row yks-child-row"><TableCell colSpan={6}><ExtraMetrics metrics={topic.metrics} reading={topic.reading} /></TableCell></TableRow></CollapsibleContent> : null}</Fragment>)}
  </TableBody></Collapsible>;
}
function TopicRowBundle({ topic, detail, params, ...props }: { topic: VisibleTopic; detail: boolean; params: ViewParams } & React.ComponentProps<"tr">) {
  return <TableRow {...props} className="yks-child-row"><TableHead scope="row"><Link href={`/yks27/tyt/topics${topicQuery({ ...params, topic: topic.id })}#konu-detayi`} className="hover:text-accent hover:underline">{topic.name}</Link>{topic.needsReview ? <span className="block text-xs text-muted">Konu adı inceleme bekliyor</span> : null}</TableHead><Cells metrics={topic.metrics} reading={topic.reading} detail={detail} /></TableRow>;
}
export function KarneTable({ groups = [], topics, detail, params, caption }: { groups?: VisibleGroup[]; topics?: VisibleTopic[]; detail: boolean; params: ViewParams; caption: string }) {
  const state = useGroupState();
  const viewParams = state ? { ...params, group: state.group || (params.q ? "none" : "") } : params;
  return <Table className={detail ? "yks-karne yks-karne-detail" : "yks-karne"}><caption className="sr-only">{caption}. SS: Soru sayısı, D: Doğru, Y: Yanlış, B: Boş. Başarı: doğru / geçerli soru.</caption><colgroup><col />{[0,1,2,3].map(i => <col key={i} className="yks-number-col" />)}<col className="yks-success-col" />{detail ? ["attempt", "accuracy", "net", "exams", "reading"].map(name => <col key={name} className={`yks-extra-col yks-${name}-col`} />) : null}</colgroup>
    <TableHeader><TableRow><TableHead scope="col">Konu Adı</TableHead>{[["SS","Soru sayısı"],["D","Doğru"],["Y","Yanlış"],["B","Boş"],["Baş. (%)","Başarı yüzdesi"]].map(([label,title]) => <TableHead scope="col" key={label} title={title}>{label}</TableHead>)}{detail ? ["Deneme oranı","Denenenlerde doğruluk","Net","Deneme sayısı","Performans"].map(label => <TableHead key={label} scope="col" className="yks-extra-col">{label}</TableHead>) : null}</TableRow></TableHeader>
    {groups.map(group => <GroupRows key={group.id} group={group} detail={detail} params={viewParams} />)}
    {topics ? <TableBody>{topics.map(topic => <TopicRows key={topic.id} topic={topic} detail={detail} params={viewParams} />)}</TableBody> : null}
  </Table>;
}
