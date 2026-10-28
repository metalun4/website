# `/yks27` UI/UX review

Reviewed and implemented 28 October 2026. The original findings below are retained as the rationale for the changes.

## Implementation

Latest layout revision: removed the topic-priority feature and its topic filtering/aggregation. Exam details now show total results, always-visible subject results, always-visible rankings, and then question analysis. “Derse atla” is always visible. This revision supersedes the topic-priority and collapsible-result recommendations below.

- Removed the unavailable edit action. Exam cards now expose net scores, search, date filters, and expandable subject results; mobile subject summaries do not require horizontal scrolling.
- Rebuilt mobile question rows to expose the topic, result, answers, and solution together. Added wrong/blank topic priorities, subject selection, a combined review filter, collapsible groups, and filters that survive reload and sign-in.
- Reduced the default dashboard to three summary metrics, one trend, and current subject results. Added previous-exam deltas and URL-based last-5/last-10/all controls. Detailed charts mount when expanded; chart props contain only the exam metadata they use.
- Added an active TYT section and breadcrumbs on reports, loading navigation, shared Turkish recovery UI, and pending retry feedback. The overview now shows the latest exam and recent change, with a smaller AYT status link.
- Added safe internal sign-in return paths, inline errors with focus, password/PIN visibility controls, and one-time PIN copy feedback and expiry. Admin destructive confirmations identify the selected record.
- Kept the palette and existing authorization/data model. No remote database or deployment changes were made.

Validation uses the production build with an isolated PostgreSQL-backed API adapter. Browser verification covered desktop and 390px/320px layouts, search, expandable subject results, deferred charts, URL filters, topic shortcuts, login error focus, restoration of a filtered report after login, and the admin page. The local Turbopack failure noted in the original review was avoided for verification by using Next.js's supported Webpack build.

Final checks passed: ESLint, TypeScript, all 31 unit/fixture/database tests, the optimized Webpack production build, and the production access/action integration suite. A fixture with 120 solution URLs confirmed that mobile solution actions fit inside the viewport. The dashboard mounts one chart initially and nine when expanded. Text and chart-series patterns, keyboard focus, labels, status announcements, and overflow behavior were reviewed against the requested skills.

For a disposable browser preview, set `YKS_UI_PREVIEW=1` and run `npm run test:access` after building. The script prints its local origin and test credentials, pauses with fixtures available, and finishes its checks and database cleanup when Enter is sent. It does not use the configured remote project.

## Original review coverage and evidence

- Inspected every route and component under `src/app/yks27`, the shared styles, and the authentication redirects.
- Browser-reviewed the authenticated overview, TYT list, progress dashboard, one complete exam report, question filtering, and the AYT placeholder. Used the default viewport, a 1440 × 1000 desktop viewport, and a 390 × 844 mobile viewport in the current dark theme.
- Confirmed that the question filter updates both the visible rows and its live announcement, and that the skip link focuses `#yks-content`.
- The admin edit URL reached a local Turbopack runtime error. Admin recommendations below are supported by source inspection; its rendered forms and import flow were not verified. Login, viewer-only behavior, empty/error states, and the light palette were inspected in source only.
- No login credentials were entered, PDFs imported, PINs created, or records deleted.

The visual foundation is consistent: restrained colors, clear card boundaries, aligned numeric columns, visible keyboard focus, labelled tables, and chart data alternatives. The largest opportunity is to make important results and useful next actions easier to reach.

## Prioritized findings by file

### `src/app/yks27/tyt/page.tsx`

- **P1 — Line 43: “Düzenle” has no corresponding edit flow.** It links to `/yks27/admin?edit=<examId>`, but `admin/page.tsx:13` does not consume that parameter or render an editor. Implement a populated editor with an explicit save result, or remove the edit action until it exists. This is a source-confirmed issue; the admin route also encountered the separate local rendering failure described above.
- **P1 — Line 47: mobile users cannot see the main score without horizontal scrolling.** The table is at least 620px wide. At 390px, the first exam’s total-net cell began around x=443, outside the viewport. Show total net, date, and rank in the card header; use compact subject summaries on mobile and keep the full table available as a secondary view. Apply the same approach to the 760px-wide tables in `tyt/[examId]/page.tsx:46`.
- **P2 — Line 38: every historical exam expands into a full table.** Even eight records require substantial scrolling, and dates and exam names are the only ways to find a record. Consider compact summary rows with expandable results, exam-name search, and a date filter. Keep search/filter state in the URL.

### `src/app/yks27/tyt/[examId]/question-analysis.tsx`

- **P1 — Line 25: solutions are difficult to reach on mobile.** The question table is at least 740px wide; a visible question’s solution link began around x=625 on the 390px viewport. A mobile question card should expose question number, topic, result, and “Çözümü aç” together. Move the repeated subject name and answer-letter detail into secondary content. Retain the semantic table for wider screens.
- **P2 — Lines 11–25: “Konu Analizi” presents individual questions without a topic summary.** The reviewed report rendered all 120 questions and was approximately 12,700px tall on mobile. Add a summary of wrong and blank counts grouped by topic, with links into the corresponding questions. Keep all questions accessible, with subject selection and collapsible groups for focused review.
- **P2 — Line 11: outcome filters disappear on reload and cannot be shared.** “Yanlış” correctly showed 16 questions, but the URL retained only the section hash. Persist subject and outcome in query parameters so a student can return directly to a review selection. Keep the existing live count announcement.

### `src/app/yks27/tyt/dashboard/page.tsx`

- **P2 — Lines 49–80: too much summary content precedes the first trend.** Eight metric cards and the header push the first chart to about y=1454 on a 390 × 844 viewport. The page contains nine charts and is approximately 6,700px tall. Lead with three or four useful metrics, then the net trend and subject breakdown. Move DPS and additional comparisons behind an “Ayrıntılı analiz” disclosure or separate view.
- **P2 — Lines 55–56: the main change metrics compare only against the first exam.** That shows long-term progress but does not quickly answer what changed most recently. Add an explicitly labelled comparison with the previous exam or a recent-exam average, and offer “Son 5 / Son 10 / Tümü” controls for the trends. Identify the comparison period beside each delta.
- **P2 — Line 86: the copy overstates what normalization establishes.** “Sınavın zorluğundan bağımsız” implies that dividing by an exam average removes difficulty effects. The displayed formula establishes a comparison with that exam’s cohort average. Prefer “Sınav ortalamasına göre performans” and explain that participant groups can differ. Use “Doğruluk” consistently instead of mixing it with “Accuracy”; keep the DPS definition available beside its label.

### `src/app/yks27/section-nav.tsx`

- **P2 — Line 16: exam details lose the active section.** Exact pathname matching leaves every navigation item inactive on `/yks27/tyt/<examId>`; this was confirmed in the browser. Keep the TYT section visually active on detail routes, use appropriate current-location semantics, and add a concise breadcrumb. Handle the dashboard explicitly so it remains the sole active destination on its own route.

### `src/app/yks27/layout.tsx`

- **P2 — Line 1: data-heavy routes lack a shared loading and recovery experience.** There is no `loading.tsx` under `/yks27`, and the only local error boundary is inside the individual exam route. Add meaningful loading skeletons and a Turkish error boundary for the list, dashboard, and admin area, with retry and a useful return link. Keep navigation available during loading and recovery. The installed Next.js documentation supports route loading boundaries and the current `retry` error prop.

### `src/app/yks27/page.tsx`

- **P3 — Lines 29–47: the overview repeats navigation without showing progress.** Add a latest-exam summary, recent net change, and a direct “Son denemeyi incele” action. Present AYT as a smaller “Hazırlanıyor” item; its current full-sized navigation card and arrow give an unavailable feature similar prominence to useful destinations. The AYT placeholder itself clearly communicates its status and provides a return to TYT.

### `src/app/yks27/forms.tsx` and authentication redirects

- **P2 — `src/lib/session.ts:36` and `src/app/yks27/actions.ts:39`: sign-in loses the requested destination.** An expired session on an exam detail link redirects to login, and successful login always returns to the overview. Preserve a validated internal return path so the user can resume the requested report or dashboard. This is based on source inspection.
- **P3 — `forms.tsx:17`: masked PIN entry has limited recovery help.** Offer an accessible show/hide control, retain paste support, and give a clear next step for an expired PIN, such as requesting a replacement from the administrator. Associate field-specific errors with the relevant input and focus the first invalid field. The existing labels, numeric input mode, and live feedback are useful foundations.
- **P3 — `forms.tsx:24`: one-time PIN output needs an explicit copy action.** It is selectable, but a copy button with announced success would make the one-time display easier to use on touch devices. Show the expiry alongside the generated PIN and explain when to copy it.

### `src/app/globals.css`

- **P2 — Line 423: only the table’s “Ders” header is sticky.** `.yks-row-label` is applied to the header cell, while body and total row labels scroll away. If horizontal tables remain, freeze the first column consistently and use an opaque background so row context stays visible. Check that focus outlines remain visible inside the overflow containers.

## Suggested implementation order

1. Resolve the edit affordance and expose mobile scores and solution actions.
2. Shorten the dashboard, add topic summaries, and preserve report/filter context.
3. Add loading/recovery states, then improve the overview and PIN workflows.

Reference: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Next.js-specific recommendations were checked against the documentation bundled with this repository’s installed version.
