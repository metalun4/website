---
version: 1
slug: "src-app-yks27-tyt-topics-page-tsx"
primary_target: "src/app/yks27/tyt/topics/page.tsx"
related_targets: ["src/app/yks27/tyt/dashboard/page.tsx","src/app/yks27/tyt/page.tsx","src/app/yks27/page.tsx"]
---

# YKS27 student workspace

Scope: `/yks27`, `/yks27/tyt`, `/yks27/tyt/dashboard`, `/yks27/tyt/topics`, `/yks27/tyt/[examId]` and the shared shell. Admin and login only inherit the shared components. Mode: Operate.

Audience and job: the student decides what to study next; a tutor or parent reads progress without context. Constraints: palette unchanged, Turkish copy, URL-driven filters, shadcn/ui components.

## Direction contract

THESIS: The dershane "Birleştirilmiş Karne" made live. The workspace owns the printed karne's subject bands and SS/D/Y/B/Baş.% columns, and refuses the stat-card-grid-plus-accordion dashboard where every metric is a sentence.

OWN-WORLD: Existing warm neutrals and blue accent, untouched. Geist, 14px body, roomy 40px rows, tabular numerals, 12px-radius bordered cards, accent-soft subject band headers, indented sub-topic rows on a muted surface, teal for doğru and amber-brown for yanlış used only for those meanings.

STORY: The reader sees totals, scans subject bands for the weakest percentages, opens a topic for its sub-topics, and switches on detailed metrics only when wanted.

FIRST VIEWPORT: Top bar with wordmark and horizontal nav; title with range control and "Ayrıntıları göster" at right; one divided summary strip of four totals; filter row with subject jump chips; then the first subject card: band header with totals, karne table with a success bar beside each percentage.

FORM: Birleştirilmiş Karne, the top-ranked grounded direction, chosen by the user over the rolled one; seed:c52ac31ea851c49e. Signature interaction: expanding a topic row reveals its sub-topic rows in place; the "Ayrıntılar" switch adds the extra metric columns to every table at once.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
