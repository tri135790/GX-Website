# Calendar UI — 2026-11-27

CalendarPage orchestrates the toolbar, filters, event cards, preview and summary.
The five presentation components live alongside it. Calendar-specific styles were
moved from globals.css/refresh.css into calendar.css. Existing layout rules are
retained first, followed by the new workspace rules and explicit portal styling.

Events retain workColors exactly. Client names precede time, personnel and
location. Lookup maps and memoized event arrays avoid repeated name searches.
The summary and existing hours calculations are below the calendar.

The date title opens the existing DayPicker library localized to Vietnamese.
Filter chips remove individual filters. Day/week grids retain scroll across date
navigation; entering a time grid from month/list resets to 08:00. The mobile
initial view is a list and resizing does not override an explicit view choice.

Preview stores a lesson ID and resolves current data. Desktop uses a Radix
virtual anchor; mobile uses a Vaul drawer. Enter opens, Escape closes and returns
focus. Preview closes before opening the existing detail/editor flow. Admin edits,
employees enter their existing detail flow, parents view details. Existing
readOnly/onCreate distinctions and drag confirmation remain intact.

## Verification

Lint, typecheck, domain regression tests and production build are run before
commit. New tests cover exact service colors/contrast, title fallbacks, Vietnamese
date boundaries and exclusive all-day ends.

Browser QA on in-memory demo covered the four views, date picking, Today,
individual personnel filter removal, desktop preview-to-editor, Enter/Escape
and focus restoration, mobile drawer and list layout. Checked widths 360, 390,
768, 1024 and 1440px without page-level overflow. Browser error log was empty.

Limitations: authenticated employee/parent sessions, real persistence failures,
drag confirmation with production data, and a formal React Profiler/large-dataset
benchmark were not verified. No measured performance improvement is claimed.
The production bundle still emits a large-chunk warning. No database migration
or backend permission change is included.
