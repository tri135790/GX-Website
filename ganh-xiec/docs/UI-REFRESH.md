# GX UI refresh

## Design and implementation

The refresh keeps GX's green identity, logo, Be Vietnam Pro, existing navigation,
permissions and business flows. `app/refresh.css`, imported after `globals.css`,
is the presentation layer for the shared shell, calendar, directories, profiles,
reports, assessments, account/settings screens and authentication forms.
Business-specific FullCalendar rules remain in the original stylesheet.

Use the semantic color, radius and spacing variables in the refresh stylesheet
when extending the interface. Desktop body text remains 14px; mobile inputs use
16px. Controls have 44px mobile touch targets. Breakpoints are 700px (mobile),
900px (sidebar) and 1100px (tablet). A manually selected mobile grid scrolls
inside the calendar; its default view remains the weekly list.

Modal content has a shared padded body. Direct form children remove their own
padding; `.form-footer` supplies sticky actions. Modal titles/descriptions are
associated with accessible IDs, background scrolling is locked while open, and
focus returns to the opener. Reports and assessments use the same action footer.
A skip link provides keyboard access to the main content.

No dependencies, database schemas, RPCs, auth configuration or domain rules changed.

## Verification — 2026-11-26

- ESLint, TypeScript (including Edge Function check), 37 existing tests and Vite
  production build passed. Build reports the existing large JavaScript chunk warning.
- Browser QA used local, in-memory admin demo data, without live writes.
- Checked calendar layout at 360, 390, 768, 1024 and 1440px; no page-level
  horizontal overflow observed. At 360px the selected week grid is 720px wide
  within its panel. Reloading at mobile width selects the list view.
- Inspected mobile work form, menu, student directory, student details,
  reports and assessment overview; desktop personnel and account lists.
- Verified empty search results, modal Tab/Shift+Tab wrapping, Escape dismissal,
  return focus and body-scroll restoration.
- Live employee/parent login, report submission, assessment submission, SMTP,
  drag/drop persistence and real database permission checks were not exercised.
  Their shared visual components are updated, but live acceptance remains necessary.
- Contrast values are chosen for readable semantic colors; this is not a full
  accessibility certification or an audit of all user-selected employee colors.

## Release

Push to `main` triggers the existing GitHub Pages workflow. Its success must be
checked separately from a successful push. Roll back with a revert commit, not a
force push. No migration is required.
