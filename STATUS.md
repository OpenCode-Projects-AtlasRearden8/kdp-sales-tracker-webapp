# STATUS.md — KDP Sales Tracker

Project status as of 2026-10-25. Everything in this folder is checked in locally; nothing is published, pushed, or hosted anywhere.

## What was built

A complete offline, single-file web app for tracking Kindle Direct Publishing (KDP) sales by hand — no scraping, no accounts, no network access of any kind:

- `index.html` — the entire app (HTML + CSS + JS inline, zero dependencies, works from `file://`):
  - Add/edit/delete typed entries (date, title, format, marketplace, optional units, royalty; negatives for refunds).
  - Manual CSV import with flexible header matching (KDP-report-friendly synonyms, quoted fields, CRLF, several date formats, `(12.34)` negatives), append or replace mode, and skip reasons with physical row numbers.
  - Monthly royalty totals with a dependency-free bar chart (per year, or all time).
  - Per-format and per-marketplace breakdowns with units, totals, and share bars.
  - Best-month chip and month-over-month trend chip (%).
  - Rank-note log per book (dated notes with optional numeric rank), plus hand-added books.
  - Year-over-year snapshot: all years side by side, month-by-month cells, totals, and YoY %.
  - Filterable entry log (newest first) with edit/delete.
  - CSV export (round-trips into the importer losslessly), CSV template download, full JSON backup/restore (rank notes included).
  - Year filter, currency symbol ($/£/€/¥/none), auto/light/dark theme — all persisted.
  - All state in `localStorage` under `kdp-sales-tracker-v1`; nothing leaves the browser.
- `tests/run-tests.mjs` — 33 zero-dependency Node tests. The aggregation/CSV/date/number math is extracted live from `index.html` between `/*@KDP-CORE-START@*/` and `/*@KDP-CORE-END@*/` markers and verified, so the tests run against the exact math the shipped app uses (plus meta checks: license line, README credit, no external URLs, unique element ids, whole-script compile).
- `README.md` — usage guide, CSV column reference, privacy notes, credits for Asdale Dynamics, LLC.
- `LICENSE` — MIT, `Copyright (c) 2026 Asdale Dynamics, LLC`.

## How to run

Open `index.html` in any modern browser — double-clicking it from your file manager works (no server, no build step). A Node install (18+) is needed only for the tests:

```sh
node tests/run-tests.mjs
```

## Verification results (actual output)

**Unit tests — 33/33 pass**, exit code 0:

```
node tests/run-tests.mjs
...
# tests 33  # pass 33  # fail 0
```

**Real-browser smoke test** — the app was loaded in headless Chrome (`google-chrome --headless=new --dump-dom file:///...index.html`-based harness) with a driver script that clicks *Load sample data*, then verifies the rendered DOM. All 20 checks pass with **zero console errors / uncaught exceptions**, including: summary cards populated ($252.54, best month May 2026, trend −83.0%), 9 monthly rows + 9 chart bars for the 2026 scope, 14 monthly rows in all-time scope, 4 format rows, 3 book rows, rank-note list rendered, year-over-year table with two years and a percentage column, 29 sample entries listed, localStorage written and re-read, dark-theme switching, and a form submission that saved a new record to localStorage. The core marker region (`@KDP-CORE-START@`/`@KDP-CORE-END@`) compiles via `node --check` and `vm.Script` as part of the suite.

**Hygiene checks in the test suite:** index.html contains no `http(s)://` URLs (fully offline guarantee), the inline script compiles, LICENSE holds the exact line `Copyright (c) 2026 Asdale Dynamics, LLC`, and README credits Asdale Dynamics, LLC.

## Known gaps

- No import deduplication: re-importing overlapping KDP report periods in *append* mode double-counts (use *replace* mode for overlapping periods).
- Totals assume one currency; KDP reports per-marketplace local currencies — convert first or break down by marketplace.
- Books cannot be renamed after creation (remove and re-add instead).
- Rank notes must be typed one at a time and don't plot against sales yet.
- The monthly chart labels all-time view by `YYYY-MM` and can get wide for long histories.
- No clipboard-copy of the CSV export (a download is offered instead).
