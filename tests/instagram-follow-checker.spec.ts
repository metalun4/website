import { expect, test } from "@playwright/test";

const path = "/instagram-follow-checker";
const canonical = `https://aydemir.website${path}`;
const title = "Instagram Follow Checker | Who Doesn’t Follow Back";

function file(name: string, content: unknown) {
  return { name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(content)) };
}

function followersFile(name: string, ...usernames: string[]) {
  return file(name, usernames.map(value => ({ string_list_data: [{ value }] })));
}

function followingFile(...usernames: string[]) {
  return file("following.json", { relationships_following: usernames.map(title => ({ title })) });
}

test.describe("indexing", () => {
  test.use({ javaScriptEnabled: false });

  test("serves the guide, metadata, crawlable links, and sitemap without JavaScript", async ({ page, request }) => {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Instagram Follow Checker");
    await expect(page.getByRole("heading", { name: "How to download Instagram followers and following data" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Can I use the tool on mobile?" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Compare Instagram followers and following JSON/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", canonical);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      const image = await page.locator(selector).getAttribute("content");
      expect(image).toMatch(new RegExp(`^${canonical}/opengraph-image`));
      const imageUrl = new URL(image!);
      const response = await request.get(`${imageUrl.pathname}${imageUrl.search}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
    }

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(jsonLd!)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      url: canonical,
      inLanguage: "en",
      isAccessibleForFree: true,
    });

    const homepage = await request.get("/");
    expect(await homepage.text()).toContain(`href="${path}"`);
    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toMatch(new RegExp(`<loc>${canonical}</loc>\\s*<lastmod>2026-11-08`));
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Allow: /");
    expect(await robots.text()).not.toContain(`Disallow: ${path}`);
  });
});

test("the Tools menu supports keyboard navigation, dismissal, and current routes", async ({ page }) => {
  await page.goto("/");
  const tools = page.locator("summary").filter({ hasText: "Tools" });
  const checker = page.getByRole("link", { name: "Instagram Follow Checker", exact: true });
  const pharmacy = page.getByRole("link", { name: "İzmir Nöbetçi Eczaneler", exact: true });

  await tools.press("Enter");
  await page.keyboard.press("Tab");
  await expect(pharmacy).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(checker).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tools).toBeFocused();
  await expect(checker).toBeHidden();

  await tools.press("Space");
  await expect(checker).toBeVisible();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(checker).toBeHidden();

  await tools.press("Enter");
  await checker.press("Enter");
  await expect(page).toHaveURL(path);
  await tools.press("Enter");
  await expect(checker).toHaveAttribute("aria-current", "page");
  await checker.press("Enter");
  await expect(tools).toBeFocused();
  await expect(checker).toBeHidden();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL("/");

  await page.route(/^https:\/\//, route => route.abort());
  await page.route("**/api/nobetci-eczaneler*", route => route.fulfill({ status: 503, body: "" }));
  await page.goto("/nobetci-eczaneler");
  await expect(page.getByRole("navigation", { name: "Site gezinmesi" })).toBeVisible();
  await page.locator("summary").filter({ hasText: "Araçlar" }).press("Enter");
  await expect(pharmacy).toHaveAttribute("aria-current", "page");
  await expect(checker).toHaveAttribute("lang", "en");
});

test("compares, searches, and clears in memory with every network request blocked after load", async ({ page, context }) => {
  const requests: string[] = [];
  let checking = false;
  await context.route("**/*", route => {
    const url = route.request().url();
    if (!checking && new URL(url).hostname === "127.0.0.1") return route.continue();
    requests.push(url);
    return route.abort();
  });
  page.on("websocket", socket => requests.push(socket.url()));
  await page.goto(path, { waitUntil: "networkidle" });
  checking = true;

  const followerInput = page.getByLabel("Choose follower files");
  const followingInput = page.getByLabel("Choose following file");
  const compare = page.getByRole("button", { name: "Compare", exact: true });
  const results = page.getByRole("region", { name: "Comparison results" });
  const list = page.getByRole("list", { name: "Accounts not following back" });
  const followers = [followersFile("followers_1.json", "DEMO_MUTUAL", "Demo_Follower"), followersFile("followers_2.json", " demo_mutual ", "Demo_Second")];
  const following = followingFile("Demo_Zeta", "demo_mutual", "Demo_Alpha", "DEMO_ALPHA");

  await expect(compare).toBeDisabled();
  await followerInput.focus();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.keyboard.press("Enter")]);
  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles(followers);
  await expect(page.getByRole("list", { name: "Selected follower files" }).getByRole("listitem")).toHaveText(["followers_1.json", "followers_2.json"]);
  await expect(page.getByText("3 unique accounts", { exact: true })).toBeVisible();
  await expect(compare).toBeDisabled();

  await followingInput.setInputFiles(following);
  await expect(page.getByRole("list", { name: "Selected following files" })).toHaveText("following.json");
  await expect(compare).toBeEnabled();
  await compare.press("Enter");
  await expect(results.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(results.locator("dd")).toHaveText(["3", "3", "1", "2"]);
  await expect(list.getByRole("link")).toHaveText([/@Demo_Alpha/, /@Demo_Zeta/]);
  const profile = list.getByRole("link").first();
  await expect(profile).toHaveAttribute("href", "https://www.instagram.com/Demo_Alpha/");
  await expect(profile).toHaveAttribute("target", "_blank");
  await expect(profile).toHaveAttribute("rel", /noopener noreferrer/);

  const search = page.getByRole("searchbox", { name: "Search usernames" });
  await search.fill(" @ZeTa ");
  await expect(list.getByRole("link")).toHaveText([/@Demo_Zeta/]);
  await search.fill("missing_demo");
  await expect(page.getByText("No usernames match your search.", { exact: false })).toBeVisible();

  expect(await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: await indexedDB.databases(),
    cacheKeys: await caches.keys(),
  }))).toEqual({ local: 0, session: 0, databases: [], cacheKeys: [] });
  expect(await context.cookies()).toEqual([]);

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(results).toBeHidden();
  await expect(compare).toBeDisabled();
  await expect(followerInput).toBeFocused();
  await expect(followerInput).toHaveValue("");
  await expect(followingInput).toHaveValue("");
  await expect(page.getByRole("list", { name: /Selected .* files/ })).toHaveCount(0);

  await followerInput.setInputFiles(followers);
  await followingInput.setInputFiles(following);
  await expect(compare).toBeEnabled();
  await compare.click();
  await expect(search).toHaveValue("");
  expect(requests).toEqual([]);

  checking = false;
  await page.reload();
  await expect(compare).toBeDisabled();
  await expect(results).toBeHidden();
  await expect(page.getByRole("list", { name: /Selected .* files/ })).toHaveCount(0);
});

test("explains invalid files, recovers on replacement, and handles empty and mutual lists", async ({ page }) => {
  await page.goto(path);
  const followers = page.getByLabel("Choose follower files");
  const following = page.getByLabel("Choose following file");
  const compare = page.getByRole("button", { name: "Compare", exact: true });
  const alert = page.getByRole("region", { name: "Compare your files" }).getByRole("alert");

  await followers.setInputFiles([
    followersFile("followers_1.json", "Demo_Mutual"),
    { name: "followers_2.json", mimeType: "application/json", buffer: Buffer.from("{") },
  ]);
  await expect(alert).toContainText(/followers_2\.json.*invalid JSON/);
  await expect(followers).toHaveAttribute("aria-invalid", "true");
  await expect(compare).toBeDisabled();

  await followers.setInputFiles(followersFile("followers_1.json"));
  await following.setInputFiles(file("following.json", []));
  await expect(alert).toHaveText(/Choose an Instagram following JSON file/);
  await expect(compare).toBeDisabled();
  await following.setInputFiles(followingFile());
  await expect(alert).toHaveCount(0);
  await expect(compare).toBeEnabled();
  await compare.click();
  await expect(page.getByText("Your export shows that you follow 0 accounts.")).toBeVisible();

  await followers.setInputFiles(file("followers_1.json", [{ string_list_data: [{ value: "Demo_Mutual" }] }, {}]));
  await following.setInputFiles(followingFile("demo_mutual"));
  await expect(page.getByText(/Skipped 1 entry with missing or invalid usernames/)).toBeVisible();
  await expect(compare).toBeEnabled();
  await compare.click();
  await expect(page.getByText("Everyone you follow also follows you back in this export.")).toBeVisible();
});

test("keeps long names and paged results usable on a narrow dark-mode viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(path);
  await page.getByLabel("Choose follower files").setInputFiles(followersFile(`${"demo_export".repeat(10)}.json`));
  await page.getByLabel("Choose following file").setInputFiles(followingFile(...Array.from({ length: 55 }, (_, i) => `demo_${String(i).padStart(2, "0")}`)));
  await page.getByRole("button", { name: "Compare", exact: true }).click();

  const list = page.getByRole("list", { name: "Accounts not following back" });
  await expect(list.getByRole("listitem")).toHaveCount(50);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(list.getByRole("listitem")).toHaveCount(5);
  await page.getByRole("searchbox").fill("demo_01");
  await expect(list.getByRole("listitem")).toHaveText([/@demo_01/]);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(28, 28, 28)");
});
