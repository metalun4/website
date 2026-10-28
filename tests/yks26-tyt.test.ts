import assert from "node:assert/strict";
import { test } from "node:test";
import { yks26Tyt, yks26TytNet, yks26TytOutperformed } from "../src/lib/yks26-tyt";
import { difference } from "../src/app/yks27/tyt/data";

test("YKS26 baseline uses the exam TYT results from the supplied image", () => {
  assert.equal(yks26Tyt.score, 310.78679);
  assert.equal(yks26Tyt.rank, 351054);
  assert.equal(yks26Tyt.participants, 2255076);
  assert.equal(Number(yks26TytOutperformed.toFixed(2)), 84.43);
  assert.equal(yks26TytNet, 56.25);
  assert.equal(yks26Tyt.subjects.reduce((n, s) => n + s.correct, 0), 60);
  assert.equal(yks26Tyt.subjects.reduce((n, s) => n + s.incorrect, 0), 15);
  assert.equal(difference(62.75, yks26TytNet), 6.5);
  assert.equal(difference(null, yks26Tyt.score), null);
});
