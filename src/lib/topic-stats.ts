// Learning statistics exclude cancelled questions. Official exam totals still
// credit those cancellations; that credit is not recomputed here.
export const MIN_VALID_QUESTIONS = 3;
export const MIN_EXAMS = 2;
export const STRONG_RATE = 0.8;
export const MISS_RATE = 0.35;

export type OutcomeCounts = {
  valid: number;
  correct: number;
  wrong: number;
  blank: number;
  cancelled: number;
  exams: number;
};

export type TopicMetrics = OutcomeCounts & {
  attempted: number;
  // Correct answers divided by valid questions. Blanks count against it.
  success: number | null;
  // Attempted answers divided by valid questions.
  attempt: number | null;
  // Correct answers divided by attempted questions. Blank-only topics stay null.
  accuracy: number | null;
  // correct - wrong / 4. Null when there is no valid question.
  net: number | null;
};

export type PerformanceReading = "empty" | "insufficient" | "strong" | "wrong" | "blank" | "mixed";

export const readingLabels: Record<PerformanceReading, string> = {
  empty: "Soru yok",
  insufficient: "Yeterli gözlem yok",
  strong: "Güçlü performans",
  wrong: "Yanlışlar öne çıkıyor",
  blank: "Boşlar öne çıkıyor",
  mixed: "Karışık sonuç",
};

const emptyCounts: OutcomeCounts = { valid: 0, correct: 0, wrong: 0, blank: 0, cancelled: 0, exams: 0 };

function rate(part: number, whole: number) {
  return whole === 0 ? null : part / whole;
}

export function topicMetrics(counts: OutcomeCounts): TopicMetrics {
  const attempted = counts.correct + counts.wrong;
  const valid = counts.valid;
  return {
    ...counts,
    attempted,
    success: rate(counts.correct, valid),
    attempt: rate(attempted, valid),
    accuracy: rate(counts.correct, attempted),
    net: valid === 0 ? null : counts.correct - counts.wrong / 4,
  };
}

export function readPerformance(metrics: Pick<TopicMetrics, "valid" | "correct" | "wrong" | "blank" | "exams" | "success" | "accuracy">): PerformanceReading {
  if (metrics.valid === 0) return "empty";
  if (metrics.valid < MIN_VALID_QUESTIONS || metrics.exams < MIN_EXAMS) return "insufficient";
  if ((metrics.success ?? 0) >= STRONG_RATE && (metrics.accuracy ?? 0) >= STRONG_RATE) return "strong";
  const wrongShare = metrics.wrong / metrics.valid;
  const blankShare = metrics.blank / metrics.valid;
  if (wrongShare >= MISS_RATE && metrics.wrong >= metrics.blank) return "wrong";
  if (blankShare >= MISS_RATE && metrics.blank > metrics.wrong) return "blank";
  return "mixed";
}

export type CountedTopic = {
  id: string;
  name: string;
  subjectId: string;
  groupId: string | null;
  needsReview: boolean;
  examIds: string[];
  counts: Omit<OutcomeCounts, "exams">;
};

export function metricsOf(topic: CountedTopic): TopicMetrics {
  return topicMetrics({ ...topic.counts, exams: topic.examIds.length });
}

export function combineTopics(topics: readonly CountedTopic[]): TopicMetrics {
  const exams = new Set<string>();
  const counts = { ...emptyCounts };
  for (const topic of topics) {
    counts.valid += topic.counts.valid;
    counts.correct += topic.counts.correct;
    counts.wrong += topic.counts.wrong;
    counts.blank += topic.counts.blank;
    counts.cancelled += topic.counts.cancelled;
    for (const id of topic.examIds) exams.add(id);
  }
  counts.exams = exams.size;
  return topicMetrics(counts);
}

export type TopicSort = "performance" | "questions" | "name";
export type TopicRange = "5" | "10" | "all";

export function topicRange(value: string): TopicRange {
  return value === "5" || value === "10" ? value : "all";
}

export function examLimitForRange(range: TopicRange): number | null {
  return range === "all" ? null : Number(range);
}

export function topicSort(value: string): TopicSort {
  return value === "questions" || value === "name" ? value : "performance";
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

const collator = new Intl.Collator("tr");

export function compareTopics(sort: TopicSort, left: { name: string; metrics: TopicMetrics }, right: { name: string; metrics: TopicMetrics }) {
  if (sort === "name") return collator.compare(left.name, right.name) || left.name.localeCompare(right.name);
  if (sort === "questions") {
    return right.metrics.valid - left.metrics.valid || right.metrics.cancelled - left.metrics.cancelled || collator.compare(left.name, right.name);
  }
  const leftSuccess = left.metrics.success;
  const rightSuccess = right.metrics.success;
  if (leftSuccess === null && rightSuccess !== null) return 1;
  if (leftSuccess !== null && rightSuccess === null) return -1;
  if (leftSuccess !== null && rightSuccess !== null && leftSuccess !== rightSuccess) return leftSuccess - rightSuccess;
  return right.metrics.valid - left.metrics.valid || collator.compare(left.name, right.name);
}

export function topicQuery(params: { range?: string; subject?: string; q?: string; sort?: string; topic?: string; group?: string }) {
  const search = new URLSearchParams();
  if (params.range && params.range !== "all") search.set("range", params.range);
  if (params.subject) search.set("subject", params.subject);
  if (params.q) search.set("q", params.q);
  if (params.sort && params.sort !== "performance") search.set("sort", params.sort);
  if (params.topic) search.set("topic", params.topic);
  if (params.group) search.set("group", params.group);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function questionHref(examId: string, subjectId: string, questionNumber: number) {
  return `/yks27/tyt/${examId}?subject=${encodeURIComponent(subjectId)}#soru-${subjectId}-${questionNumber}`;
}
