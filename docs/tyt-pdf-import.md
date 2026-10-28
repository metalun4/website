# TYT PDF import

This replaces manual exam entry at `/yks27/admin`. Admin login and viewer PINs use the existing server-only session system. Viewers can read reports and charts but cannot preview, import, or delete exams.

## Setup and release

Use Node 24+, install with `npm ci`, and keep the existing server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_ID`, and `SESSION_SECRET` environment variables. No public Supabase key, new database credential, Storage bucket, OCR service, or paid service is needed.

For the existing database, apply `supabase/migrations/20261028135230_tyt_pdf_import.sql` with the matching application release. This intentionally drops the old `exams` table and its summary records; the user authorized this reset. Existing sessions, PINs, login rate limiting, and Auth users are preserved. The migration is not a repeatable reset script: do not rerun it after applying it.

For an empty database, run `supabase/schema.sql` instead. It includes the existing authentication tables and the same exam definitions/functions. The application does not automatically run migrations or modify the remote schema on startup. Avoid running the old app build against the new schema or the new build against the old schema. This development work does not deploy the site or change the remote database.

`npm run build` and `npm run dev` automatically package the PDF worker. `next build` or `next dev` invoked directly must be preceded by `node scripts/build-pdf-worker.mjs`. The generated worker is ignored in Git and explicitly included in the Next.js server file trace with the PDF.js runtime files. File parsing runs in a worker with a 20-second deadline and V8 heap limits (128 MiB old generation, 16 MiB young generation); buffers/native allocations are not a total process-memory limit. Files are limited to 2 MiB, two pages, 20,000 text items and 250 annotations per page.

## Workflow

1. Sign in as the administrator and open **Yönetim**.
2. Choose/drop one individual two-page TYT PDF, then select **PDF’yi önizle**.
3. Review the full exam name, date, totals, 13 subject results, four rankings, link count, and provisional topic labels.
4. Select **Onayla ve içe aktar**. Confirmation rechecks the file, session, expiry, and parsed report. No client-supplied exam data is trusted.

Preview creates no database rows. The original file remains in browser/request memory and is not uploaded to Storage. `source_pdf_path` is NULL. There are no saved booklet fields, student names/numbers, estimated ÖSYM rankings, or historical-report data. The manual form and obsolete external PDF URL field have been removed. Imported answers are authoritative; correcting a report currently means deleting it and importing a corrected source PDF.

The single database RPC resolves topics and inserts every report record in one transaction. Failure rolls back newly created topics too. A transaction-level advisory lock serializes imports across app instances. Identical semantic imports return the existing exam. Ambiguous same-day collisions return a warning without overwriting. Different exams may share a date. Confirmation receipts last ten minutes and are bound to the current session, file bytes, and parsed contents. Both steps require admin access; the RPC also verifies the live admin session. Thirty PDF requests per admin session per 15-minute window reuse the existing database rate limiter.

## Vercel Hobby and Supabase Free optimizations

- `vercel.json` selects the single London region (`lhr1`), near the existing Supabase project's `eu-west-2` database. The setting takes effect on the next deployment. Static pages still use the CDN. No paid region/failover feature is enabled.
- Admin page actions have a 60-second maximum duration. PDF workers have their own 20-second deadline, and each Supabase HTTP request has a 10-second timeout. Limits cap stalled work; they are not expected normal execution times. If confirmation times out after the database commits, repeat the normal preview/confirmation flow: duplicate detection protects the saved exam.
- Session and PIN lookups are memoized only within a React server request. The confirmation path explicitly bypasses that memoization after parsing, and the SQL RPC checks the live session again. Revocation and expiry are never cached across requests.
- Exam list/dashboard queries return just the four displayed subject summaries, the general ranking, and the used exam columns. The 13 complete subject results and all four rankings remain stored. A representative uncompressed exam response shrank from 3,503 to 659 bytes (81%); this is not a measurement of gzip or billed network traffic.
- Topic creation and question insertion use set-based SQL. Each distinct label is inserted once, existing topics are left unchanged, and repeated questions do not create unnecessary topic row versions. A local PGlite benchmark of 25 imports measured median database call time of 37 ms before and 13 ms after this change. Hosted Supabase latency and CPU use can differ.
- Invalid, expired, session-mismatched or changed-file confirmation receipts are rejected before starting PDF extraction. Valid confirmations still reparse the original PDF and validate its digest.
- Original PDFs are not stored, and imports use one transactional persistence RPC. There is no added storage duplication, background service, cron job, connection pool, or paid add-on. The existing HTTPS Data API avoids holding direct PostgreSQL connections from Vercel.

Local Next.js server traces measured 6.50 MiB for admin, 2.16 MiB for TYT listing, and 2.23 MiB for the dashboard, excluding deployment-platform runtime overhead. Test/build dependencies are absent from these runtime traces. The live Supabase database measured about 11 MB before applying the exam reset migration. These measurements indicate ample size headroom for personal use, not a guarantee about the account's monthly traffic/CPU quotas.

Current official limits should be checked before changing plans: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel function limits](https://vercel.com/docs/functions/limitations), and [Supabase pricing](https://supabase.com/pricing). Hobby's function memory allocation is fixed at 2 GB/1 vCPU; the worker's V8 limits protect parsing and do not change Vercel's allocated memory. Supabase Free includes 500 MB database size and 5 GB egress and can pause after a week of inactivity. No keep-alive requests are introduced to alter this behavior.

The Vercel connection listed the project but returned HTTP 403 when reading its settings, so its live region, runtime configuration and usage were not verified. No deployment or remote database modification was performed by this optimization pass.

## Topic handling and format assumptions

Topics come exclusively from the individual report. The supplied TYT/AYT study lists were reference material, not a canonical alias map or instructions to seed topics. Only the specified 12 TYT subjects are seeded. The schema accepts future AYT subjects (including `ayt_math`) without ownership columns or mandatory topic hierarchies.

Labels use NFKC normalization, Turkish lowercasing and consistent whitespace. Exact subject/name matches are reused atomically. A truncated prefix alone never expands a name, even if only one current canonical label matches. Printed truncated labels are provisional topics with `needs_review=true`; they are listed in both preview and import results. Identical provisional labels identify an unresolved printed label, not proven canonical identity. No fuzzy merging occurs. Topic review/merging UI is outside this feature.

The parser recognizes the supplied report family's section headings and three parallel question tables. Header-based cell boundaries and positions preserve blank cells, separate subjects, and printed numbering. It independently reconciles all question answers with direct/aggregate subject results. Reported averages are retained, including rounding differences. It rejects missing/ambiguous required data rather than taking values from historical sections.

Some supplied Calibri/Carlito ToUnicode maps replace ligatures with NUL. A bounded repair adapter verifies embedded glyph-outline SHA-256 digests against independently checked font outlines and GSUB definitions before replacing those mappings. No font binaries or guessed words are distributed. Unknown defective fonts are rejected. Different layouts, scanned/encrypted PDFs, missing answer keys without an explicit cancellation marker, and combined reports are unsupported. Solution URLs are read from PDF annotations and never fetched or invented.

## Development checks

Implementation files: `src/lib/exam-import/` contains extraction, font repair, parsing, validation, normalization, topic resolution, preview receipts, worker orchestration and persistence. `src/app/yks27/admin/import-form.tsx` and `import-actions.ts` implement the UI and authorized server boundary. `src/lib/exams.ts` and `src/app/yks27/tyt/data.ts` adapt normalized results to the existing views. The admin page, forms, actions and TYT listing remove the manual-entry and external-link flow. `next.config.ts`, `scripts/build-pdf-worker.mjs`, dependency lockfiles and ignore rules package the worker. Schema definitions live in `supabase/schema.sql` and the migration. `tests/pdf-import.test.ts`, `tests/database.test.ts`, independent fixture goldens, and `scripts/test-access.mjs` provide the checks below. Existing unrelated working-tree changes were retained.

```powershell
$env:YKS_PDF_FIXTURE_DIR = 'C:\Users\baris\Documents\ykspdf'
npm test
npm run typecheck
npm run lint
npm run build
npm run test:access
```

`npm test` includes independent goldens for all six PDFs (720 questions, every reported subject cell, score/date/counts, ranking, and link), normalization, topic ambiguity, signed receipts, malformed/unsupported input, SQL constraints, permissions, exact persistence and rollback. Original PDFs are not committed because they contain personal data. Missing fixtures fail explicitly. Goldens were generated independently with pypdf/pdfplumber table grids and font verification; the production position parser is PDF.js-based.

SQL tests use PGlite's embedded PostgreSQL engine with the actual schema and functions. The `Promise.all` duplicate test exercises queued requests in that engine; it does **not** prove lock behavior across separate native PostgreSQL connections. Stage 3 should additionally test simultaneous requests against a disposable Supabase/native PostgreSQL database. The tests never mutate the configured remote project.

`test:access` runs the actual production Next.js server and server actions against an isolated HTTP adapter backed by PostgreSQL. It covers admin/viewer/anonymous access, real PDF preview/confirmation, no writes on preview, file tampering, CSRF, duplicate retries, cancelled-report rejection, normalized listings/charts, warnings, cascading deletion, PIN revocation, rate limiting, logout, and client-bundle credential checks. It requires a successful build first.

The additional ÖZDEBİR report is supported: Mathematics questions 17 and 25 are explicitly printed as `İPTAL`. The answer field preserves that marker (without fabricating an A–E key), and the reported totals credit both questions as correct. Their selected answers remain NULL and their printed topic label is retained as `İPTAL`; this marker is not a known curriculum topic. Cancellations appear individually as `İPTAL` warnings in the import preview. A missing answer key without an explicit cancellation marker is still rejected, as are reports whose totals do not reconcile with credited cancellations. The extra 345 report is supported. No five-page combined reference was supplied; a generated five-page document tests the page-count rejection path. Independent Stage 3 QA and deployment remain separate stages.

## Cancellation schema update

For an existing installation, apply `supabase/migrations/20261028154317_cancelled_questions.sql` before releasing the matching application update. It changes `exam_questions.correct_answer` from `char(1)` to constrained text accepting A–E or `İPTAL`, and updates transactional answer reconciliation. Existing exam records and privileges are preserved. Fresh installations use `supabase/schema.sql`, which includes this update.
