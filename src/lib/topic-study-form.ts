import type { StudyGroup } from "./topic-study-view";

export function studyBatchSelection(groups: readonly StudyGroup[], selected: readonly string[]) {
  const unmarked = groups.filter(group => group.completedOn === null);
  const selectedIds = new Set(selected);
  const groupIds = unmarked.filter(group => selectedIds.has(group.id)).map(group => group.id);
  return { unmarked, groupIds };
}

/** Submit the same state that drives the checkboxes, date and selected count. */
export function createStudyBatchFormData(subjectId: string, groupIds: readonly string[], completedOn: string): FormData {
  const form = new FormData();
  form.set("subjectId", subjectId);
  form.set("completedOn", completedOn);
  for (const id of groupIds) form.append("groupIds", id);
  return form;
}
