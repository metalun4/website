---
name: "YKS27 Study Workspace"
description: "A live Birleştirilmiş Karne for reading exam progress and topic performance."
colors:
  accent: "#2458a6"
  accent-soft: "#e2eaf7"
  chart-primary: "#2563eb"
  chart-secondary: "#0f766e"
  chart-tertiary: "#b45309"
  chart-quaternary: "#7c3aed"
  background: "#f3f2ef"
  foreground: "#333331"
  surface: "#faf9f6"
  surface-muted: "#eae8e3"
  surface-emphasis: "#e4e2dd"
  muted: "#66645f"
  subtle: "#706e68"
  border: "#d6d4ce"
  accent-dark: "#a0bff0"
  accent-soft-dark: "#283448"
  chart-primary-dark: "#60a5fa"
  chart-secondary-dark: "#2dd4bf"
  chart-tertiary-dark: "#fbbf24"
  chart-quaternary-dark: "#c4b5fd"
  background-dark: "#1c1c1c"
  foreground-dark: "#deddd8"
  surface-dark: "#242424"
  surface-muted-dark: "#2b2b2a"
  surface-emphasis-dark: "#333332"
  muted-dark: "#b2b0aa"
  subtle-dark: "#9e9c96"
  border-dark: "#434341"
typography:
  headline:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline-narrow:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  table-label:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "20px"
  metric:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.02em"
  metric-lead:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  compact: "12px"
  md: "16px"
  panel: "20px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-primary-dark:
    backgroundColor: "{colors.accent-dark}"
    textColor: "{colors.background-dark}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.foreground}"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
  subject-band:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.foreground}"
    typography: "{typography.title}"
    padding: "13px 24px"
  jump-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
    padding: "6px 12px"
  navigation-current:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
---

# Design System: YKS27 Study Workspace

## Overview

**Creative North Star: "Birleştirilmiş Karne, made live"**

YKS27 translates the familiar printed dershane report into a calm, compact study workspace. Subject bands, aligned numbers and indented topic rows make performance easy to scan. The visual hierarchy supports a student deciding what to study next and a tutor or parent reading the same numbers without prior context.

This system applies to the private `/yks27` workspace and its shared UI. Login, admin and AYT inherit the shell and primitives; their content has not received the full student-page redesign. The public portfolio, pharmacy finder and Instagram tool keep their existing appearance. The radius and type rules below belong to the YKS scope, not to those public surfaces.

**Key Characteristics:**

- Warm neutral surfaces with the existing blue accent in both system themes.
- Real tables, labelled tabular figures and restrained subject bands.
- One divided summary strip before filters and detailed records.
- In-place topic expansion and extra metrics disclosed on request.
- Flat bordered cards, visible focus and generous touch actions.

## Colors

The existing palette pairs warm light neutrals and neutral dark surfaces with blue navigation and distinct chart inks. Frontmatter values without a suffix are light-theme values; each `-dark` value is its counterpart under `prefers-color-scheme: dark`. The source custom properties retain their unsuffixed names and change within that media query. There is no theme toggle or class-based dark mode.

### Primary

- **Study Blue — accent:** wordmark year, primary actions, links, selected navigation, focus outlines and success bars.
- **Soft Blue — accent-soft:** active pills, subject bands, selection and tap feedback.
- **Chart Blue — chart-primary:** the first chart series; retain its distinction from the interface accent.

### Secondary

- **Correct Teal — chart-secondary:** correct counts and correct outcomes. The YKS semantic alias is `--correct`.

### Tertiary

- **Incorrect Amber — chart-tertiary:** wrong counts and incorrect outcomes; also the existing destructive semantic mapping. The YKS incorrect alias is `--incorrect`.
- **Comparison Violet — chart-quaternary:** an additional chart series, not a general decorative accent.

### Neutral

- **Warm Ground — background:** page canvas and primary-action foreground.
- **Reading Ink — foreground:** primary text and child-topic names.
- **Paper Surface — surface:** cards, fields and opaque numeric-cell backing.
- **Muted Surface — surface-muted:** child-row backing, control trays and hover surfaces.
- **Emphasis Surface — surface-emphasis:** aggregate table footers.
- **Muted Ink — muted:** secondary text, labels and placeholders.
- **Subtle Ink — subtle:** tertiary chart annotations and reference lines.
- **Hairline — border:** table dividers, card edges and field strokes.

**The Text-and-Surface Rule.** The original `--muted` is text ink. Use `--surface-muted` for muted backgrounds; never adopt the shadcn background meaning for this existing text token.

**The Outcome Pairing Rule.** Preserve the exact correct and incorrect inks. Numeric D/Y cells use opaque `--surface` backing, including child rows, totals and hover states; preserve the surrounding muted row treatment. Labels and headers carry meaning alongside color.

## Typography

**Headline and Body Font:** Geist, with Arial and sans-serif fallbacks. The loaded family is shared, while YKS sizes and radii are scoped locally.

**Character:** Clear product typography with compact labels and slightly tightened headings. Tabular numerals apply throughout the workspace; Turkish interface copy and `tr-TR` number formatting keep records consistent.

### Hierarchy

- **Headline:** the page title uses the headline token; the narrow token applies at widths up to (600px).
- **Title:** subject-band headings use the title token. Standard shadcn card titles use medium weight, while bands use semibold.
- **Body:** the body token is the default; karne cells use an explicit line height of (20px). Control labels commonly use medium weight.
- **Label:** summary labels, supporting notes, jump links and compact metrics use the label token. Table column headings use the table-label token.
- **Metric:** summary values use the metric token, with the metric-lead token for a leading total. Comparison strips use (24px); narrow summaries use responsive values between (20px) and (24px), and lead figures between (22px) and (30px).

**The Aligned Figures Rule.** Keep numbers tabular and right-aligned in tables. Topic names remain left-aligned and may wrap; compactness must not turn labels into clipped text.

## Layout

The page frame centers content within (1180px), with desktop padding of (32px 24px 64px). At widths up to (600px), padding becomes (24px 12px 48px). The top bar has a minimum height of (56px); its wordmark has a (44px) action height.

Use the existing small spacing rhythm for related controls and larger gaps for sections: compact field gaps, panel padding, then clear breaks between major records. The heading and actions share a desktop row; at (900px) and below they stack. The horizontal navigation becomes a mobile sheet at the same breakpoint. At (1150px) and below the desktop navigation first becomes more compact.

Summary values sit in a single bordered definition-list strip with hairline divisions. The number of columns follows the item count. At widths up to (800px), the five-item topics summary becomes three items above two wider items; at widths up to (600px), four-item strips become two by two. Numeric values never wrap. Preserve labels when rearranging these cells.

The topics filter uses subject, flexible search, sort and submit columns. At widths up to (600px), the form stacks into a two-column layout with full-width subject and search fields. Subject jump links wrap below it.

Karne tables keep a flexible name column and compact numeric columns. On wide screens numeric columns occupy (6.2%) each and success occupies (20%); narrow tables use (8.4%) numeric columns. Detail mode shows extra columns only from (1200px), with separate Net and Deneme sayısı columns and single-line performance badges; below that width the same metrics appear as definition lists beneath each row. The (120px by 6px) desktop success bar becomes (40px by 4px) on narrow screens and is hidden below (400px) and in wide detail mode.

Exam question tables become labelled card-like grid rows at widths up to (767px), while retaining their table markup. Other wide result tables may scroll within their table container. A coarse pointer or width up to (767px) raises controls and standalone action links to at least (44px) target dimensions; text inputs and native selects use (16px) text there.

## Elevation & Depth

Cards and fields are flat: YKS explicitly removes their box shadows. Surface tones, hairline borders, subject bands and row indentation establish hierarchy. Selected range controls use a single inset border rather than a raised card effect. Focus adds an accent outline; buttons retain their component ring, while fields remain shadowless.

The mobile navigation sheet is an overlay exception: it retains the component's large soft shadow and a foreground-tinted backdrop. This overlay treatment does not turn ordinary cards into elevated panels.

### Shadow Vocabulary

- **Sheet overlay:** the existing large shadow separates modal navigation from the page; its exact CSS is recorded in the sidecar.
- **Selected segment:** an inset (1px) border distinguishes the current range on a surface-colored segment.

**The Flat Records Rule.** Ordinary record cards remain bordered and shadowless; reserve overlay depth for the navigation sheet.

## Shapes

YKS defines a compact rounded scale in its own scope: small corners for selected segments, medium corners for sheet links and question chips, large corners for default controls, and extra-large corners for cards. Navigation and jump links use pills. Status badges retain the component's pill shape; they can wrap and grow vertically.

Cards use a (1px) border and clip band backgrounds to their corners. Default buttons and fields have a minimum height of (36px), with touch sizing supplied by the responsive rules. Preserve the public site's existing Tailwind radius and type defaults outside YKS.

## Components

### Buttons

Compact, direct actions with medium-weight text.

- **Primary:** accent fill and background-colored ink; hover mixes the accent to (80%) opacity.
- **Outline:** border and background fill; hover uses the muted surface. The dark variant uses the existing input/border color at (30%) fill and (50%) on hover.
- **Ghost:** transparent at rest, muted surface on hover; dark hover uses that surface at (50%) opacity.
- **Link:** accent text with an underline on hover.
- **Focus / active / disabled:** visible accent outline of (2px), offset (3px), alongside the component ring; active buttons shift down (1px) where applicable. Disabled controls reduce opacity and stop pointer interaction.
- **Sizing:** default horizontal padding is (14px). Touch layouts increase action bounds; icon actions receive matching minimum widths.

### Chips

Jump links are quiet surface-filled pills with muted ink and a border. Hover changes the border and ink to accent. They wrap across lines and receive full touch height where required. Question chips use medium corners, compact outcome copy and distinct solution links.

### Cards / Containers

Paper surfaces with extra-large corners, hairline edges and no card shadow. Generic cards use the component's shared padding; panels use (20px). Subject cards remove internal gaps and padding so their colored band, optional subsection headings and full-width table form one continuous record.

### Inputs / Fields

Surface-filled, bordered fields with large corners and muted placeholders. Focus uses the accent border and shared visible outline; the YKS field override keeps box shadows off. Invalid and disabled states retain the component semantics; errors require explanatory text rather than color alone. Native selects follow the same sizing and surface treatment.

### Navigation

The top bar places the wordmark left, page links beside it and account actions at the right. Links use muted ink at rest, foreground ink on a muted hover surface, and accent ink on a soft-blue active pill. Current routes use `aria-current`; exam reports keep TYT selected and nested admin pages keep administration selected. The mobile sheet presents vertical links with medium corners and at least (44px) height.

### Divided Summary Strip

A single definition list contains labelled totals, separated by borders. Correct and incorrect values retain their semantic inks on the surface background; a lead figure uses the accent. Summary cells reflow as a unit rather than becoming separate floating cards.

### Karne Table

The signature record uses real table headers and row headers, a subject band, and the columns Konu Adı, SS, D, Y, B and Baş. (%). Rows use compact padding and borders rather than decorative separators. Child topics keep foreground names, indentation and a muted surface backing; D/Y cells retain their opaque surface contrast treatment.

A chevron button expands children in place with `aria-expanded`; its rotation transitions over (150ms ease-out). Expansion writes the `group` URL parameter, and searches open matching groups. Topic links reach the per-exam breakdown. A missing success value is “Soru yok”, not a failure percentage.

### Disclosure, Status and Charts

The “Ayrıntılar” switch defaults off; `view=detail` enables the extra metrics across tables and the supporting explanations. Its visible track is (36px by 20px), while the label and expanded hit area provide the touch action. The range control uses a muted tray, surface-colored selected segment and inset border.

Performance badges use a bordered, text-bearing outline treatment. Charts retain the existing series colors, line patterns, markers and labelled data access, so color is not their sole identifier. Reduced-motion preference disables YKS transitions, animations and smooth scrolling; ordinary control transitions use the existing (150ms) default, with the sheet using (200ms).

## Do's and Don'ts

### Do:

- **Do** scope this system to the YKS27 workspace and preserve the public portfolio, pharmacy and Instagram appearance.
- **Do** use the existing light/dark semantic palette and follow the system color preference.
- **Do** keep summaries together, subject records tabular, numbers labelled and child rows indented.
- **Do** keep D/Y numeric cells on opaque surface backing in child, total and hover states.
- **Do** provide visible keyboard focus, text status cues, reduced motion and at least 44px touch actions.
- **Do** keep detailed metrics opt-in and preserve shareable URL state.

### Don't:

- **Don't** use the legacy muted text token as a background.
- **Don't** add new hues or recolor correct and incorrect outcomes.
- **Don't** replace the karne's records with a grid of independent metric cards.
- **Don't** depict missing observations as zero-percent failure.
- **Don't** spread the YKS typography and radius overrides onto public pages.
- **Don't** add ordinary card shadows or treat the navigation sheet's overlay depth as a card default.

