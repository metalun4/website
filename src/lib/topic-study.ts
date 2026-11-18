import "server-only";
import { cache } from "react";
import { db } from "./storage";
import { requireSession } from "./session";
import { isUuid } from "./topic-stats";
import { parseStudyAnalysis, parseStudyCatalog } from "./topic-study-view";

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  return db(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
}

export const loadStudyCatalog = cache(async () => {
  await requireSession("/yks27/tyt/study");
  return parseStudyCatalog(await rpc("topic_study_catalog", {}));
});

export const loadStudyAnalysis = cache(async (examId: string, includeQuestions: boolean) => {
  await requireSession();
  if (!isUuid(examId) || typeof includeQuestions !== "boolean") throw new Error("Deneme analizi isteği doğrulanamadı.");
  const analysis = parseStudyAnalysis(await rpc("tyt_study_analysis", { target_exam: examId, include_questions: includeQuestions }), includeQuestions);
  if (analysis.examId.toLowerCase() !== examId.toLowerCase()) throw new Error("Deneme analizi eşleşmedi.");
  return analysis;
});
