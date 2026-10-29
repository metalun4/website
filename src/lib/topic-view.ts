import { normalizeTopic } from "./exam-import/normalize";
import { SUBJECTS } from "./exam-import/types";
import {
  combineTopics, compareTopics, metricsOf, readPerformance,
  type CountedTopic, type PerformanceReading, type TopicMetrics, type TopicSort,
} from "./topic-stats";

export type AnalysisExam = { id: string; name: string; examDate: string };
export type AnalysisSubject = { id: string; name: string; parentId: string | null; displayOrder: number };
export type AnalysisGroup = { id: string; subjectId: string; name: string; displayOrder: number };

export type TopicAnalysis = {
  examTotal: number;
  exams: AnalysisExam[];
  subjects: AnalysisSubject[];
  groups: AnalysisGroup[];
  topics: CountedTopic[];
};

export type VisibleTopic = CountedTopic & { metrics: TopicMetrics; reading: PerformanceReading };
export type VisibleGroup = AnalysisGroup & {
  metrics: TopicMetrics;
  reading: PerformanceReading;
  topics: VisibleTopic[];
};
export type VisibleSubject = AnalysisSubject & {
  metrics: TopicMetrics;
  groups: VisibleGroup[];
  unassignedQuestions: number;
};
export type VisibleSection = { id: string; name: string; displayOrder: number; subjects: VisibleSubject[] };

const directSubjectIds = new Set<string>(SUBJECTS.filter(subject => subject.count > 0).map(subject => subject.id));
export const topicSubjectAllowed = (value: string) => directSubjectIds.has(value);

function integer(value: unknown, label: string) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} okunamadı.`);
  return number;
}
function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} okunamadı.`);
  return value;
}
function object(value: unknown) {
  if (typeof value === "string") return JSON.parse(value) as unknown;
  return value;
}
function rows(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Konu istatistiği okunamadı.");
  return value;
}

export function parseTopicAnalysis(value: unknown): TopicAnalysis {
  const payload = object(value) as Record<string, unknown>;
  return {
    examTotal: integer(payload.exam_total, "Deneme sayısı"),
    exams: rows(payload.exams).map(row => {
      const exam = row as Record<string, unknown>;
      return { id: text(exam.id, "Deneme"), name: text(exam.name, "Deneme adı"), examDate: text(exam.exam_date, "Deneme tarihi").slice(0, 10) };
    }),
    subjects: rows(payload.subjects).map(row => {
      const subject = row as Record<string, unknown>;
      return {
        id: text(subject.id, "Ders"),
        name: text(subject.name, "Ders adı"),
        parentId: typeof subject.parent_id === "string" ? subject.parent_id : null,
        displayOrder: integer(subject.display_order, "Ders sırası"),
      };
    }),
    groups: rows(payload.groups).map(row => {
      const group = row as Record<string, unknown>;
      return {
        id: text(group.id, "Konu grubu"),
        subjectId: text(group.subject_id, "Ders"),
        name: text(group.name, "Grup adı"),
        displayOrder: integer(group.display_order, "Grup sırası"),
      };
    }),
    topics: rows(payload.topics).map(row => {
      const topic = row as Record<string, unknown>;
      const examIds = rows(topic.exam_ids).map(id => text(id, "Deneme"));
      return {
        id: text(topic.id, "Konu"),
        name: text(topic.name, "Konu adı"),
        subjectId: text(topic.subject_id, "Ders"),
        groupId: typeof topic.group_id === "string" ? topic.group_id : null,
        needsReview: topic.needs_review === true,
        examIds,
        counts: {
          valid: integer(topic.valid, "Soru"),
          correct: integer(topic.correct, "Doğru"),
          wrong: integer(topic.wrong, "Yanlış"),
          blank: integer(topic.blank, "Boş"),
          cancelled: integer(topic.cancelled, "İptal"),
        },
      };
    }),
  };
}

export type TopicAlias = { id: string; subjectId: string; groupId: string; alias: string };
export type TopicCatalog = TopicAnalysis & { aliases: TopicAlias[] };

export function parseTopicCatalog(value: unknown): TopicCatalog {
  const payload = object(value) as Record<string, unknown>;
  return {
    ...parseTopicAnalysis(payload),
    aliases: rows(payload.aliases).map(row => {
      const alias = row as Record<string, unknown>;
      return { id: text(alias.id, "Takma ad"), subjectId: text(alias.subject_id, "Ders"), groupId: text(alias.group_id, "Grup"), alias: text(alias.alias, "Takma ad") };
    }),
  };
}

export type BreakdownQuestion = {
  questionNumber: number;
  subjectId: string;
  correctAnswer: string;
  selectedAnswer: string | null;
  solutionUrl: string | null;
};
export type BreakdownExam = {
  id: string;
  name: string;
  examDate: string;
  metrics: TopicMetrics;
  questions: BreakdownQuestion[];
};
export type TopicBreakdown = {
  topic: { id: string; name: string; subjectId: string; groupId: string | null; groupName: string | null; needsReview: boolean } | null;
  exams: BreakdownExam[];
};

export function parseTopicBreakdown(value: unknown): TopicBreakdown {
  const payload = object(value) as Record<string, unknown>;
  const topic = payload.topic && typeof payload.topic === "object" ? payload.topic as Record<string, unknown> : null;
  return {
    topic: topic ? {
      id: text(topic.id, "Konu"),
      name: text(topic.name, "Konu adı"),
      subjectId: text(topic.subject_id, "Ders"),
      groupId: typeof topic.group_id === "string" ? topic.group_id : null,
      groupName: typeof topic.group_name === "string" ? topic.group_name : null,
      needsReview: topic.needs_review === true,
    } : null,
    exams: rows(payload.exams).map(row => {
      const exam = row as Record<string, unknown>;
      const counts = {
        valid: integer(exam.valid, "Soru"),
        correct: integer(exam.correct, "Doğru"),
        wrong: integer(exam.wrong, "Yanlış"),
        blank: integer(exam.blank, "Boş"),
        cancelled: integer(exam.cancelled, "İptal"),
      };
      return {
        id: text(exam.id, "Deneme"),
        name: text(exam.name, "Deneme adı"),
        examDate: text(exam.exam_date, "Deneme tarihi").slice(0, 10),
        metrics: metricsOf({ id: "", name: "", subjectId: "", groupId: null, needsReview: false, examIds: counts.valid ? ["exam"] : [], counts }),
        questions: rows(exam.questions).map(item => {
          const question = item as Record<string, unknown>;
          return {
            questionNumber: integer(question.question_number, "Soru numarası"),
            subjectId: text(question.subject_id, "Ders"),
            correctAnswer: text(question.correct_answer, "Doğru cevap"),
            selectedAnswer: typeof question.selected_answer === "string" && question.selected_answer ? question.selected_answer : null,
            solutionUrl: typeof question.solution_url === "string" ? question.solution_url : null,
          };
        }),
      };
    }),
  };
}

function withReading(topic: CountedTopic): VisibleTopic {
  const metrics = metricsOf(topic);
  return { ...topic, metrics, reading: readPerformance(metrics) };
}

export function buildTopicView(analysis: TopicAnalysis, options: { subjectId: string; query: string; sort: TopicSort }) {
  const needle = normalizeTopic(options.query);
  const subjectId = topicSubjectAllowed(options.subjectId) ? options.subjectId : "";
  const inSubject = (id: string) => !subjectId || id === subjectId;
  const topics = analysis.topics.filter(topic => inSubject(topic.subjectId)).map(withReading);
  const groupedTopics = topics.filter(topic => topic.groupId);
  const unassigned = topics.filter(topic => !topic.groupId);
  const overall = combineTopics(topics);
  const grouped = combineTopics(groupedTopics);
  const scopedGroups = analysis.groups.filter(group => inSubject(group.subjectId)).map(group => {
    const members = topics.filter(topic => topic.groupId === group.id);
    const metrics = combineTopics(members);
    return { ...group, members, metrics, reading: readPerformance(metrics) };
  });
  const groups = scopedGroups.flatMap(group => {
    const nameMatches = !needle || normalizeTopic(group.name).includes(needle);
    const matching = group.members.filter(topic => !needle || normalizeTopic(topic.name).includes(needle));
    if (needle && !nameMatches && !matching.length) return [];
    const visible = !needle || nameMatches ? group.members : matching;
    return [{
      id: group.id,
      subjectId: group.subjectId,
      name: group.name,
      displayOrder: group.displayOrder,
      metrics: group.metrics,
      reading: group.reading,
      topics: [...visible].sort((left, right) => compareTopics(options.sort, left, right)),
    }];
  }).sort((left, right) => compareTopics(options.sort, left, right) || left.displayOrder - right.displayOrder);

  const subjects = analysis.subjects.filter(subject => directSubjectIds.has(subject.id) && inSubject(subject.id));
  const sections: VisibleSection[] = [];
  for (const subject of subjects) {
    const parent = subject.parentId ? analysis.subjects.find(item => item.id === subject.parentId) : subject;
    const sectionId = parent?.id ?? subject.id;
    let section = sections.find(item => item.id === sectionId);
    if (!section) {
      section = { id: sectionId, name: parent?.name ?? subject.name, displayOrder: parent?.displayOrder ?? subject.displayOrder, subjects: [] };
      sections.push(section);
    }
    const subjectTopics = topics.filter(topic => topic.subjectId === subject.id);
    section.subjects.push({
      ...subject,
      metrics: combineTopics(subjectTopics),
      groups: groups.filter(group => group.subjectId === subject.id),
      unassignedQuestions: subjectTopics.filter(topic => !topic.groupId).reduce((sum, topic) => sum + topic.counts.valid + topic.counts.cancelled, 0),
    });
  }
  sections.sort((left, right) => left.displayOrder - right.displayOrder);
  for (const section of sections) section.subjects.sort((left, right) => left.displayOrder - right.displayOrder);

  const ranked = topics.filter(topic => topic.metrics.valid > 0);
  return {
    subjectId,
    searching: Boolean(needle),
    overall,
    grouped,
    overallReading: readPerformance(overall),
    sections: sections.filter(section => section.subjects.some(subject => subject.groups.length > 0 || !needle)),
    unassigned: [...unassigned].filter(topic => !needle || normalizeTopic(topic.name).includes(needle)).sort((left, right) => compareTopics(options.sort, left, right)),
    unassignedAll: unassigned,
    topWrong: [...ranked].sort((left, right) => right.metrics.wrong - left.metrics.wrong || right.metrics.valid - left.metrics.valid).filter(topic => topic.metrics.wrong > 0).slice(0, 5),
    topBlank: [...ranked].sort((left, right) => right.metrics.blank - left.metrics.blank || right.metrics.valid - left.metrics.valid).filter(topic => topic.metrics.blank > 0).slice(0, 5),
    topStrong: ranked.filter(topic => topic.reading === "strong").sort((left, right) => (right.metrics.success ?? 0) - (left.metrics.success ?? 0)).slice(0, 5),
    encounteredGroups: scopedGroups.filter(group => group.metrics.valid > 0).length,
  };
}
