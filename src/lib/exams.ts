import "server-only";
import { db } from "./storage";
import { requireSession } from "./session";
import type { Exam } from "@/app/yks27/tyt/data";
import type { SubjectResult, Ranking } from "./exam-import/types";

type ExamSummary = {
  id: string; name: string; exam_date: string; average_net: number | null;
  exam_subject_results: Pick<SubjectResult, "subject_id" | "result_scope" | "correct_count" | "wrong_count" | "average_net">[];
  exam_rankings: Ranking[];
};

export type StoredExam = Exam & { id: string };
export async function getExams() {
  await requireSession();
  // Read only the four displayed subject summaries and the general ranking.
  // The nine detailed results, three other rankings, and unused exam columns
  // stay in the database rather than consuming Free-tier egress on each view.
  const rows = await db<ExamSummary[]>("exams?exam_type=eq.TYT&select=id,name,exam_date,average_net,exam_subject_results(subject_id,result_scope,correct_count,wrong_count,average_net),exam_rankings(scope,rank,participant_count)&exam_subject_results.subject_id=in.(tyt_turkish,tyt_social,tyt_math,tyt_science)&exam_subject_results.or=(result_scope.eq.aggregate,subject_id.eq.tyt_turkish)&exam_rankings.scope=eq.general&order=exam_date.asc,id.asc");
  return rows.map(row => {
    const general = row.exam_rankings.find(r => r.scope === "general");
    return {
      id: row.id, name: row.name, date: row.exam_date, rank: general?.rank ?? null,
      participants: general?.participant_count ?? null, average_net: row.average_net,
      subjects: [ ["tyt_turkish", "direct"], ["tyt_social", "aggregate"], ["tyt_math", "aggregate"], ["tyt_science", "aggregate"] ].map(([id, scope]) => {
        const r = row.exam_subject_results.find(r => r.subject_id === id && r.result_scope === scope);
        return { correct: r?.correct_count ?? null, incorrect: r?.wrong_count ?? null, average: r?.average_net ?? null };
      }),
    } satisfies StoredExam;
  });
}
