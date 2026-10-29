import "server-only";
import { cache } from "react";
import { db } from "./storage";
import { requireAdmin, requireSession } from "./session";
import { examLimitForRange, type TopicRange } from "./topic-stats";
import { parseTopicAnalysis, parseTopicBreakdown, parseTopicCatalog } from "./topic-view";

async function rpc<T>(name: string, args: Record<string, unknown>) {
  return db<T>(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
}

export const loadTopicAnalysis = cache(async (range: TopicRange) => {
  await requireSession();
  return parseTopicAnalysis(await rpc("tyt_topic_analysis", { exam_limit: examLimitForRange(range) }));
});

export const loadTopicBreakdown = cache(async (topicId: string, range: TopicRange) => {
  await requireSession();
  return parseTopicBreakdown(await rpc("topic_exam_breakdown", { target_topic: topicId, exam_limit: examLimitForRange(range) }));
});

export async function loadTopicCatalog() {
  await requireAdmin();
  return parseTopicCatalog(await rpc("topic_admin_catalog", {}));
}
