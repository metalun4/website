import { normalizeTopic, truncated } from "./normalize";
import type { Topic } from "./types";

// A shared prefix is not evidence that two canonical topics are identical.
// A provisional row represents an unresolved printed label, never a canonical expansion.
export function resolveTopic(subjectId: string, label: string, existing: Topic[]) {
  const normalized_name = normalizeTopic(label);
  const match = existing.find(t => t.subject_id === subjectId && t.normalized_name === normalized_name);
  if (match) return { existing: match, create: null };
  return { existing: null, create: { subject_id: subjectId, name: label.trim(), normalized_name, needs_review: truncated(label) } };
}
