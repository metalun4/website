// Optional browser QA using a caller-supplied Playwright installation; no new
// application dependency. Invoked by test:access when YKS_PLAYWRIGHT_MODULE is set.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export async function testDetailBrowser({ origin, cookie, detailPath, cancelledPath, expected, setFailure }) {
  const { chromium } = require(process.env.YKS_PLAYWRIGHT_MODULE);
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const context = await browser.newContext();
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: origin, httpOnly: true }]);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + detailPath);
      await page.locator('[data-question]').last().waitFor();
      assert.equal(await page.locator('[data-question]').count(), 120);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}px`);
      for (const [label, count] of [["Doğru", expected.exam.total_correct], ["Yanlış", expected.exam.total_wrong], ["Boş", expected.exam.total_blank], ["İptal", 0], ["Tümü", 120]]) {
        const button = page.getByRole("button", { name: label, exact: true });
        await button.focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(n => document.querySelectorAll('[data-question]').length === n, count);
        assert.equal(await button.getAttribute("aria-pressed"), "true");
      }
      await page.getByRole("link", { name: "Geometri (10)", exact: true }).click();
      assert.equal(new URL(page.url()).hash, "#questions-tyt_geometry");
      if (width < 740) {
        const region = page.getByRole("region", { name: "Geometri konu analizi", exact: true });
        await region.focus();
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => document.querySelector('#questions-tyt_geometry [role=region]').scrollLeft > 0);
      }
    }
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(origin + cancelledPath);
    await page.getByRole("button", { name: "İptal", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-question]').length === 2);
    assert.equal(await page.getByRole("cell", { name: "İptal · Doğru sayıldı", exact: true }).count(), 2);
    assert.deepEqual(errors, [], "No hydration or client exceptions");
    setFailure(true);
    await page.goto(origin + detailPath);
    await page.getByRole("heading", { name: "Deneme raporu yüklenemedi" }).waitFor();
    setFailure(false);
    await page.getByRole("button", { name: "Tekrar dene" }).click();
    await page.locator('[data-question]').last().waitFor();
    assert.equal(await page.locator('[data-question]').count(), 120);
    console.log("PASS: browser desktop/390px/320px, keyboard filters and subject navigation, table scrolling, no page overflow or hydration errors, dark mode cancellation filter, error recovery.");
  } finally { setFailure(false); await browser.close(); }
}
