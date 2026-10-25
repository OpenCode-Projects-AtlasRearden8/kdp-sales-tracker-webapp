# KDP Sales Tracker

An offline, single-file web app for tracking your Kindle Direct Publishing (KDP) sales **by hand** — no scraping, no account linking, no servers. You type entries (or paste/import a CSV you exported from KDP), and the tracker does the totals: monthly royalties, per-format and per-marketplace breakdowns, a best-month chip, a month-over-month trend chip, a rank-note log per book, and a year-over-year snapshot. Everything lives in your browser's `localStorage`.

Built the way we like our tools: plain English, warm, zero dependencies, and it works straight from `file://` — just open the file.

> Pair it with **kdp-profit-planner** (same shop), which handles the planning math: pricing, print costs, and royalty scenarios. One app plans the numbers; this one keeps the score.

## Who it's for

Independent authors who want a quiet, local-first record of how their books sell — especially if you like keeping your own numbers close. Part of the beginner-friendly tool lineup from **Asdale Dynamics, LLC** (see [dylanasdale.github.io](https://dylanasdale.github.io) and the book *The Massive AI Manual* for the plain-English AI guides).

## Quick start

1. Open `index.html` in any modern browser (double-click it, or `open index.html` / `xdg-open index.html`). A local server is not required.
2. Log a sale in the form at the top — date, title, format, marketplace, optional units, royalty.
3. Or click **Import CSV…** and load rows from your own spreadsheet or a KDP report export.
4. Click **Load sample data** if you want to see it working before committing your real numbers.

Your data is saved to `localStorage` automatically on every change.

## Features

- **Monthly royalty totals** — table plus a zero-dependency bar chart, with entries/units counts and share-of-total per month.
- **Per-format breakdown** — paperback vs Kindle vs hardcover vs audiobook (custom formats too), with units and share.
- **Per-marketplace breakdown** — Amazon.com, Amazon.co.uk, Amazon.de, and friends (canonical list included, custom marketplaces allowed, anything unmapped falls into "Other").
- **Best month chip** — your strongest month in the selected view.
- **Trend chip** — latest month vs the previous month, with a percentage.
- **Rank-note log per book** — dated notes with an optional numeric rank, so you can remember what a promo or ad did to your sales rank.
- **Year-over-year snapshot** — every year side by side, month by month, with a YoY % column (all-time scope).
- **Entry log** — newest first, with a text filter, plus edit and delete on each row.
- **CSV export** — clean, escaped output that imports back into this app losslessly.
- **CSV import** — flexible header matching (see below), append or replace modes, and clear skip reasons with row numbers.
- **JSON backup/restore** — one-click full backup (includes rank notes and settings).
- **Theme** — auto (follows your system), light, or dark; currency symbol selectable ($, £, €, ¥, or none); year filter scopes the whole dashboard.
- **Fully offline & private** — no network calls, no external assets, no analytics. Works from `file://`.

## CSV import details

The importer looks for a header row, then matches columns flexibly (case-insensitive, any order, hyphens ignored):

| Field | Accepted header names include |
|---|---|
| Date (required) | `Date`, `sales date`, `Amazon-Ordered-At`, anything containing "date"/"ordered" |
| Title (required) | `Title`, `book`, `book title`, `product title`, `ASIN`, `item` |
| Format | `Format`, `type`, `book format`, `product type`, `edition` |
| Marketplace | `Marketplace`, `Amazon-Marketplace`, `store`, `country`, `channel` |
| Units | `Units`, `qty`, `quantity`, `copies`, `units sold` |
| Royalty (required) | `Royalty`, `royalties`, `royalty amount`, `Royalty-USD`, `earnings`, `revenue`, `amount` |

Accepted date formats: `2026-09-14`, `2026/09/14`, `9/14/2026`, `2026-09` (month-only, pinned to the 1st). Royalty accepts `7.18`, `$7.18`, `1,234.56`, `(12.34)` as negative (refunds). Rows that can't be understood are skipped — the import summary tells you exactly which line numbers and why, so you can fix them and rerun.

The built-in template (`Download CSV template`) shows the exact shape the exporter writes:

```csv
Date,Title,Format,Marketplace,Units,Royalty
2026-09-14,The Massive AI Manual,Paperback,Amazon.com,2,7.18
2026-09-21,The Massive AI Manual,Kindle (eBook),Amazon.co.uk,1,2.41
```

*Note on currencies:* KDP reports royalties in each marketplace's local currency. The tracker sums amounts as given, so if you mix marketplaces, convert to one currency first or use the year/marketplace breakdowns to keep like-with-like.

## Data & privacy

- Everything is stored under a single `localStorage` key (`kdp-sales-tracker-v1`) in your browser, private to your machine. Nothing is uploaded, synced, or scraped — the app performs **zero** network requests.
- Backups: **Export CSV** saves your entries; **Backup (JSON)** also saves rank notes and settings. Use **Restore backup…** to bring a JSON backup back.
- Clearing your browser data / storage will wipe the tracker; keep occasional backups.

## Testing

The aggregation math (CSV parsing, date/number normalization, monthly totals, breakdowns, best month, trend, YoY snapshot, CSV round-trip) is extracted from `index.html` between the `/*@KDP-CORE-START@*/` and `/*@KDP-CORE-END@*/` markers and tested directly — so the tests run against the exact math the shipped app uses.

```sh
node tests/run-tests.mjs
```

Requires only Node.js (18+). No packages to install.

## Known gaps

- No entry deduplication on import (append duplicates could double-count overlapping report lines — use **replace** mode when re-importing overlapping periods).
- No per-graph currency conversion; totals assume one currency (see note above).
- Books can't be renamed after creation (remove and re-add instead).
- No multi-record note import; rank notes are typed one at a time.
- Rank notes don't plot against sales yet — that's a future nice-to-have.

## Credits

**KDP Sales Tracker** is built and maintained by **Asdale Dynamics, LLC** — Dylan Asdale's shop for beginner-friendly AI education, author tools, and local-first software. It's MIT licensed (see `LICENSE`), and it's part of a family of practical tools alongside *The Massive AI Manual* and the guides at [dylanasdale.github.io](https://dylanasdale.github.io).

Copyright (c) 2026 Asdale Dynamics, LLC.
