import assert from "node:assert/strict";
import { test } from "node:test";
import { loginHref, safeReturnTo } from "../src/lib/yks-navigation";

test("sign-in retains supported workspace routes and review query parameters", () => {
  const report = "/yks27/tyt/01234567-89ab-cdef-0123-456789abcdef?result=review&subject=tyt_math#konu-analizi";
  assert.equal(safeReturnTo(report), report);
  assert.equal(new URL(loginHref(report), "https://example.test").searchParams.get("returnTo"), report);
  for (const route of ["/yks27", "/yks27/admin", "/yks27/admin/topics?subject=tyt_math", "/yks27/ayt", "/yks27/tyt?q=ÖZDEBİR", "/yks27/tyt/dashboard?range=5", "/yks27/tyt/topics?range=5&subject=tyt_math&q=Problem"]) {
    assert.equal(new URL(safeReturnTo(route), "https://example.test").pathname, route.split("?")[0]);
  }
  assert.equal(loginHref("/yks27"), "/yks27/login");
});

test("untrusted return destinations cannot leave the workspace or loop through login", () => {
  for (const target of [null, undefined, {}, "https://evil.test/yks27", "//evil.test/yks27", "/\\evil.test", "/yks27/../../outside", "/yks27/login", "/yks27other", "/yks27/tyt/not-a-uuid", "/yks27/tyt/topics/extra", "/yks27/admin/topics/extra", "/yks27/tyt/------------------------------------", "/yks27\n/location", "/%79ks27", "/yks27/%2f%2fevil.test"]) {
    assert.equal(safeReturnTo(target), "/yks27", String(target));
  }
});
