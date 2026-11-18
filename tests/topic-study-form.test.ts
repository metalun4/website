import assert from "node:assert/strict";
import { test } from "node:test";
import { createStudyBatchFormData, studyBatchSelection } from "../src/lib/topic-study-form";
import type { StudyGroup } from "../src/lib/topic-study-view";

const subjectId = "tyt_math";
const first = "00000000-0000-0000-0000-000000000001";
const second = "00000000-0000-0000-0000-000000000002";
const marked = "00000000-0000-0000-0000-000000000003";
const date = "2026-09-01";
const groups: StudyGroup[] = [first, second, marked].map((id, index) => ({
  id, subjectId, name: id, displayOrder: index, completedOn: id === marked ? "2026-08-01" : null,
}));

test("batch selection excludes marked and unknown groups and counts each checkbox once", () => {
  const selected = [second, marked, "another-subject-group", first, first];
  const { unmarked, groupIds } = studyBatchSelection(groups, selected);
  assert.deepEqual(unmarked.map(group => group.id), [first, second]);
  assert.deepEqual(groupIds, [first, second]);
  assert.equal(groupIds.length, 2);
  assert.deepEqual(selected, [second, marked, "another-subject-group", first, first]);
});

test("a failed batch can retry the same IDs and date without reading native form fields", () => {
  const selected = [first, second];
  const { groupIds } = studyBatchSelection(groups, selected);
  const submission = createStudyBatchFormData(subjectId, groupIds, date);
  assert.deepEqual(submission.getAll("groupIds"), [first, second]);
  assert.deepEqual(submission.getAll("completedOn"), [date]);
  assert.deepEqual(submission.getAll("subjectId"), [subjectId]);

  // An unsuccessful action retains selection/date state. A retry builds a fresh
  // payload from that state, regardless of the previous form's native values.
  submission.delete("groupIds");
  submission.set("completedOn", "");
  const retrySelection = studyBatchSelection(groups, selected).groupIds;
  const retry = createStudyBatchFormData(subjectId, retrySelection, date);
  assert.deepEqual(retry.getAll("groupIds"), [first, second]);
  assert.deepEqual(retry.getAll("completedOn"), [date]);
  assert.equal(retrySelection.length, retry.getAll("groupIds").length);
});

test("select all uses only unmarked groups and refreshed marks leave the batch selection", () => {
  const { unmarked } = studyBatchSelection(groups, []);
  const selectAll = unmarked.map(group => group.id);
  assert.deepEqual(studyBatchSelection(groups, selectAll).groupIds, [first, second]);

  const refreshed = groups.map(group => group.id === first ? { ...group, completedOn: date } : group);
  assert.deepEqual(studyBatchSelection(refreshed, selectAll).groupIds, [second]);
  const cleared = studyBatchSelection(refreshed, []);
  assert.deepEqual(cleared.groupIds, []);
  assert.deepEqual(createStudyBatchFormData(subjectId, cleared.groupIds, date).getAll("groupIds"), []);
  assert.deepEqual(cleared.unmarked.map(group => group.id), [second]);
});
