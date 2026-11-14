# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The student (primary).** One YKS 2027 candidate who sits a TYT practice exam roughly every week and opens the workspace afterwards to decide what to study next.
- **A tutor or parent (secondary).** Reads the same pages to follow progress. They arrive without the student's context, so every number must be labelled and readable on its own.
- **Admin.** The student's own admin role: imports exam result PDFs and maps topic labels to curriculum groups.

## Product Purpose

YKS27 is a private study workspace inside a personal website. It turns imported practice-exam results into a progress record: total net over time, per-subject results, per-question analysis, and success per curriculum topic across exams. Success means the student can name, within a minute of opening it, which topics cost the most questions and whether the net is trending up.

## Positioning

It merges every imported exam into one topic record keyed to the student's own curriculum grouping, the way a dershane "birleştirilmiş karne" does, but live, filterable, and linked down to the single question and its solution PDF.

## Operating Context

- Used after each practice exam and before planning a study week; on a laptop at a desk and on a phone.
- The reference document users already know is the printed "Konu Başarı Analizi" karne: per subject and topic, SS (soru sayısı), D (doğru), Y (yanlış), B (boş), Baş.(%), with sub-topics indented under their topic.
- All interface copy is Turkish; numbers use tr-TR formatting.

## Capabilities and Constraints

- Routes: `/yks27` (overview), `/yks27/tyt` (exam list), `/yks27/tyt/dashboard` (progress), `/yks27/tyt/topics` (topic success), `/yks27/tyt/[examId]` (exam report with question analysis), `/yks27/ayt` (placeholder), `/yks27/admin/*`, `/yks27/login`.
- Session-gated; pages are `noindex`. Roles: viewer and admin.
- Topic metrics: geçerli soru, doğru, yanlış, boş, iptal, başarı (doğru / geçerli), deneme oranı, denenenlerde doğruluk, net (doğru − yanlış / 4), deneme sayısı, and a performance reading with minimum-observation thresholds. Cancelled questions are excluded from topic success.
- Filters live in the URL (range, subject, search, sort, selected topic/group) so views are shareable and server-rendered.
- Stack: Next.js 16 App Router (RSC), React 19, Tailwind v4, d3 charts, Supabase data.
- AYT is not built yet.

## Brand Commitments

- The existing color palette (warm neutral surfaces, blue accent, the four chart colors, light and dark) is binding and stays unchanged.
- The wordmark "YKS 2027" stays.

## Evidence on Hand

- Real imported exam data in the database; no demo data should be invented for production views.
- The dershane "Birleştirilmiş Karne" PDF as the reference for the default topic table.

## Product Principles

1. The answer to "what should I study next?" comes before any explanation of method.
2. Summary first, detail on request: default views match the printed karne; deeper metrics open only when asked.
3. Never read weakness into missing data: unseen or thinly observed topics are stated as such, not ranked.
4. Every number is labelled well enough for a reader without context.
5. Every view is a URL.

## Accessibility & Inclusion

Keyboard-reachable controls with visible focus, 44px touch targets, skip link, reduced-motion respected, light and dark themes, and status never conveyed by color alone.
