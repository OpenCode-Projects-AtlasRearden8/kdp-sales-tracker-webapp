import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const APP_DIR = new URL('..', import.meta.url).pathname;
const html = readFileSync(APP_DIR + 'index.html', 'utf8');
const START = '/*@KDP-CORE-START@*/';
const END = '/*@KDP-CORE-END@*/';

function extractCore() {
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  assert.ok(a !== -1, 'KDP-CORE-START marker present');
  assert.ok(b !== -1 && b > a, 'KDP-CORE-END marker after start marker');
  return html.slice(a + START.length, b);
}

function extractFullScript() {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'inline script tag found');
  return m[1];
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInNewContext(extractCore(), sandbox);

const {
  MONTH_NAMES, CANON_FORMATS, CANON_MARKETPLACES,
  normalizeDateString, parseRoyaltyValue, parseUnitsValue, canonicalizeValue,
  csvEscape, parseCSVText, matchColumns, makeId, parseKdpCsv, recordsToCsv, templateCsv,
  filterRecordsByYear, round1, fmtMoney, fmtInt, pctChangeNum, monthLabel,
  distinctYears, latestYear, buildAggregates
} = sandbox;

const approx = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    (msg ? msg + ': ' : '') + 'expected ~' + expected + ', got ' + actual
  );

const norm = v => JSON.parse(JSON.stringify(v));

/* ---------- meta: the shipped artifact itself ---------- */

test('core exports the documented aggregation API', () => {
  for (const name of [
    'normalizeDateString', 'parseRoyaltyValue', 'parseUnitsValue', 'canonicalizeValue',
    'csvEscape', 'parseCSVText', 'matchColumns', 'makeId', 'parseKdpCsv', 'recordsToCsv',
    'filterRecordsByYear', 'fmtMoney', 'fmtInt', 'pctChangeNum', 'monthLabel',
    'distinctYears', 'latestYear', 'buildAggregates', 'roundMoney'
  ]) {
    assert.equal(typeof sandbox[name], 'function', name + ' is a function');
  }
  assert.equal(MONTH_NAMES.length, 12);
});

test('the whole inline script compiles (runtime syntax check)', () => {
  new vm.Script(extractFullScript());
});

test('app is fully offline (no external scripts, styles, or urls)', () => {
  assert.ok(!/script\s+[^>]*src=/i.test(html), 'no external script src');
  assert.ok(!/<link[^>]+href=https?:/i.test(html), 'no external stylesheet');
  assert.ok(!/https?:\/\//i.test(html), 'no http(s) URLs anywhere in index.html');
  assert.ok(/<!DOCTYPE html>/i.test(html));
  assert.ok(/@KDP-CORE-START@/.test(html) && /@KDP-CORE-END@/.test(html));
});

test('element ids referenced by the app exist and are unique', () => {
  const markup = html.slice(0, html.indexOf('<script>'));
  const ids = [...markup.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  assert.ok(ids.length > 10);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], 'duplicate ids: ' + dupes.join(', '));
});

test('LICENSE keeps the exact required copyright line, README credits the LLC', () => {
  const license = readFileSync(APP_DIR + 'LICENSE', 'utf8');
  assert.ok(license.includes('Copyright (c) 2026 Asdale Dynamics, LLC'), 'exact copyright line');
  assert.ok(license.includes('MIT License'));
  const readme = readFileSync(APP_DIR + 'README.md', 'utf8');
  assert.ok(readme.includes('Asdale Dynamics, LLC'), 'README credits the LLC');
  assert.ok(readme.includes('MIT'));
});

/* ---------- date parsing ---------- */

test('normalizeDateString accepts ISO, slashes, and US month-first forms', () => {
  assert.equal(normalizeDateString('2026-09-14'), '2026-09-14');
  assert.equal(normalizeDateString('2026/09/14'), '2026-09-14');
  assert.equal(normalizeDateString('2026-9-4'), '2026-09-04');
  assert.equal(normalizeDateString('1/5/2026'), '2026-01-05');
  assert.equal(normalizeDateString('12/31/2026'), '2026-12-31');
  assert.equal(normalizeDateString(' 2026-07-04 '), '2026-07-04');
});

test('normalizeDateString refuses impossible dates', () => {
  assert.equal(normalizeDateString('2026-13-01'), null);
  assert.equal(normalizeDateString('2026-02-31'), null);
  assert.equal(normalizeDateString('2026-00-10'), null);
  assert.equal(normalizeDateString('yesterday'), null);
  assert.equal(normalizeDateString(''), null);
  assert.equal(normalizeDateString(null), null);
  assert.equal(normalizeDateString('2026-03'), '2026-03-01');
  assert.equal(normalizeDateString('2026-13'), null);
});

/* ---------- number parsing ---------- */

test('parseRoyaltyValue handles currency text and negatives', () => {
  assert.equal(parseRoyaltyValue('7.18'), 7.18);
  assert.equal(parseRoyaltyValue('$1,234.56'), 1234.56);
  assert.equal(parseRoyaltyValue(' 12 '), 12);
  assert.equal(parseRoyaltyValue('(12.34)'), -12.34);
  assert.equal(parseRoyaltyValue('-3.4'), -3.4);
  assert.equal(parseRoyaltyValue('+5'), 5);
  assert.equal(parseRoyaltyValue('1,234'), 1234);
  assert.equal(parseRoyaltyValue('2,41'), 2.41);
  assert.equal(parseRoyaltyValue(''), null);
  assert.equal(parseRoyaltyValue('n/a'), null);
  assert.equal(parseRoyaltyValue(null), null);
  assert.equal(parseRoyaltyValue('--4'), null);
});

test('parseUnitsValue rounds whole numbers and rejects junk', () => {
  assert.equal(parseUnitsValue('3'), 3);
  assert.equal(parseUnitsValue(' 2 '), 2);
  assert.equal(parseUnitsValue(''), null);
  assert.equal(parseUnitsValue('2.6'), 2.6);
});

/* ---------- canonicalization ---------- */

test('canonicalizeValue uses canonical casing from the lists', () => {
  assert.equal(canonicalizeValue('paperback', CANON_FORMATS), 'Paperback');
  assert.equal(canonicalizeValue('KINDLE', CANON_FORMATS), 'Kindle (eBook)');
  assert.equal(canonicalizeValue('Hardcover ', CANON_FORMATS), 'Hardcover');
  assert.equal(canonicalizeValue('Booklet', CANON_FORMATS), 'Booklet');
  assert.equal(canonicalizeValue('amazon.com', CANON_MARKETPLACES), 'Amazon.com');
  assert.equal(canonicalizeValue(' AMAZON.CO.UK ', CANON_MARKETPLACES), 'Amazon.co.uk');
  assert.equal(canonicalizeValue('Gumroad', CANON_MARKETPLACES), 'Gumroad');
  assert.equal(canonicalizeValue('', CANON_FORMATS), '');
});

/* ---------- csv parsing ---------- */

test('parseCSVText handles quotes, commas, and escaped quotes', () => {
  const rows = norm(parseCSVText('a,b,c\n"x,y",z,"say ""hi"" "'));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].cells, ['a', 'b', 'c']);
  assert.deepEqual(rows[1].cells, ['x,y', 'z', 'say "hi" ']);
});

test('parseCSVText handles CRLF, CR-only, blank lines, and quoted newlines', () => {
  const rows = norm(parseCSVText('a,b\r\nc,d\r\n\r\n"two\nlines",e\rf,g\n'));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0].cells, ['a', 'b']);
  assert.deepEqual(rows[1].cells, ['c', 'd']);
  assert.deepEqual(rows[2].cells, ['two\nlines', 'e']);
  assert.deepEqual(rows[3].cells, ['f', 'g']);
  assert.deepEqual(norm(parseCSVText('a')), [{ cells: ['a'], line: 1 }]);
  assert.deepEqual(norm(parseCSVText('')), []);
  assert.deepEqual(norm(parseCSVText('a,\n')), [{ cells: ['a', ''], line: 1 }]);
});

test('parseCSVText keeps a physical line number per row', () => {
  const rows = norm(parseCSVText('a\nb,c\n"q\ntwo\nlines",d'));
  assert.deepEqual(norm(rows.map(r => r.line)), [1, 2, 3]);
});

/* ---------- column matching ---------- */

test('matchColumns recognizes common KDP-friendly headers', () => {
  const cases = [
    ['Date', 'Title', 'Format', 'Marketplace', 'Units', 'Royalty'],
    ['date', 'book', 'type', 'store', 'quantity', 'amount'],
    ['Amazon-Ordered-At', 'Title', 'Type', 'Amazon-Marketplace', 'Qty', 'Royalty-USD'],
    ['sales date', 'product title', 'edition', 'country', 'units sold', 'royalties']
  ];
  for (const header of cases) {
    assert.deepEqual(norm(matchColumns(header)),
      { date: 0, title: 1, format: 2, marketplace: 3, units: 4, royalty: 5 }, header.join('|'));
  }
});

test('matchColumns does not confuse unit price with units', () => {
  assert.equal(norm(matchColumns(['Date', 'Title', 'Units', 'Unit Price'])).units, 2);
});

/* ---------- full csv import ---------- */

test('parseKdpCsv imports clean csv with synonyms and canonicalization', () => {
  const csv = 'date,book,type,store,qty,amount\n' +
    '2026-02-11,My Book,paperback,amazon.com,1,2.41\n' +
    '2/19/2026,Another,Kindle,Amazon.co.uk,3,"7,25"\n';
  const res = norm(parseKdpCsv(csv));
  assert.equal(res.headerFound, true);
  assert.equal(res.skipped.length, 0);
  assert.equal(res.records.length, 2);
  const [a, b] = res.records;
  assert.equal(a.date, '2026-02-11');
  assert.equal(a.title, 'My Book');
  assert.equal(a.format, 'Paperback');
  assert.equal(a.marketplace, 'Amazon.com');
  assert.equal(a.units, 1);
  approx(a.royalty, 2.41);
  assert.equal(b.date, '2026-02-19');
  assert.equal(b.format, 'Kindle (eBook)');
  assert.equal(b.marketplace, 'Amazon.co.uk');
  assert.equal(b.units, 3);
  approx(b.royalty, 7.25);
  assert.ok(a.id && b.id && a.id !== b.id, 'ids generated and unique');
});

test('parseKdpCsv reports skipped rows with reasons and line numbers', () => {
  const csv = 'Date,Title,Format,Marketplace,Units,Royalty\n' +
    '2026-02-11,Good,Paperback,Amazon.com,1,2.41\n' +
    'not-a-date,Skipped,Paperback,Amazon.com,1,5.00\n' +
    '2026-02-12,BadMoney,Paperback,Amazon.com,1,on-sale\n' +
    '2026-02-14,,Paperback,Amazon.com,1,5.00\n' +
    '2026-02-13,Good again,Kindle,Amazon.com,,0\n';
  const res = norm(parseKdpCsv(csv));
  assert.equal(res.records.length, 2);
  assert.equal(res.skipped.length, 3);
  assert.match(res.skipped[0].reason, /bad or missing date/);
  assert.equal(res.skipped[0].line, 3);
  assert.match(res.skipped[1].reason, /bad or missing royalty/);
  assert.equal(res.skipped[1].line, 4);
  assert.match(res.skipped[2].reason, /missing title/);
  assert.equal(res.skipped[2].line, 5);
  assert.equal(res.records[1].units, null);
  assert.equal(res.records[1].royalty, 0);
});

test('parseKdpCsv refuses csv without a real header, treats blank file gently', () => {
  assert.equal(parseKdpCsv('just,some\nnoise').headerFound, false);
  const empty = parseKdpCsv('   \n  ');
  assert.equal(empty.headerFound, false);
  assert.equal(empty.records.length, 0);
  assert.equal(empty.skipped.length, 0);
  assert.equal(parseKdpCsv('').skipped.length, 0);
});

/* ---------- aggregation math ---------- */

function rec(date, title, format, marketplace, units, royalty) {
  return { id: 'x' + Math.random(), date, title, format, marketplace, units, royalty };
}

const FIXTURE = [
  rec('2026-01-05', 'Alpha', 'Paperback', 'Amazon.com', 2, 7.18),
  rec('2026-02-11', 'Alpha', 'kindle', '', 1, 2.41),
  rec('2026-02-19', 'Alpha', 'Paperback', 'Amazon.com', 1, 7.18),
  rec('2025-03-10', 'Beta', 'Kindle', 'amazon.co.uk', 3, 7.23),
  rec('2026-03-15', 'Beta', 'Paperback', 'Amazon.de', 2, 14.36),
  rec('2025-01-20', 'Gamma', 'Paperback', 'Amazon.com', 1, 7.18),
  rec('2026-02-20', 'Alpha', 'Paperback', 'Amazon.com', null, 7.18)
];

test('filterRecordsByYear selects only the requested year', () => {
  assert.equal(filterRecordsByYear(FIXTURE, 2026).length, 5);
  assert.equal(filterRecordsByYear(FIXTURE, '2025').length, 2);
  assert.equal(filterRecordsByYear(FIXTURE, null).length, 7);
  assert.equal(filterRecordsByYear(FIXTURE, 1999).length, 0);
});

test('buildAggregates sums months, entries, and units', () => {
  const agg = norm(buildAggregates(FIXTURE));
  assert.equal(agg.count, 7);
  approx(agg.grandTotal, 52.72, 'grandTotal');
  assert.equal(agg.grandUnits, 10);
  const map = new Map(agg.months.map(m => [m.ym, m]));
  approx(map.get('2025-01').total, 7.18);
  approx(map.get('2025-03').total, 7.23);
  approx(map.get('2026-01').total, 7.18);
  approx(map.get('2026-02').total, 16.77, 'Feb total');
  approx(map.get('2026-02').units, 2, 'null units count as zero');
  approx(map.get('2026-03').total, 14.36);
  assert.deepEqual(norm(agg.months.map(m => m.ym)),
    ['2025-01', '2025-03', '2026-01', '2026-02', '2026-03'], 'months sorted ascending');
  assert.equal(map.get('2026-02').count, 3);
});

test('buildAggregates picks the best month (earliest wins ties)', () => {
  const all = norm(buildAggregates(FIXTURE));
  assert.equal(all.bestMonth.ym, '2026-02');
  approx(all.bestMonth.total, 16.77);
  const tie = norm(buildAggregates([
    rec('2026-03-02', 'T', 'Paperback', 'Amazon.com', 1, 5),
    rec('2026-01-01', 'T', 'Paperback', 'Amazon.com', 1, 5)
  ]));
  assert.equal(tie.bestMonth.ym, '2026-01', 'tie broken by earliest ym');
  assert.equal(buildAggregates([]).bestMonth, null);
});

test('buildAggregates trends month over month', () => {
  const agg = norm(buildAggregates(FIXTURE));
  assert.ok(agg.trend);
  assert.equal(agg.trend.fromYm, '2026-02');
  assert.equal(agg.trend.toYm, '2026-03');
  approx(agg.trend.toTotal, 14.36);
  approx(agg.trend.pct, -14.4, 'Mar vs Feb ~ -14.4%');
  const oneMonth = norm(buildAggregates([rec('2026-01-01', 'A', 'P', 'Amazon.com', 1, 3)]));
  assert.equal(oneMonth.trend, null);
  const jump = norm(buildAggregates([
    rec('2026-01-01', 'A', 'P', 'Amazon.com', 1, 10),
    rec('2026-02-01', 'A', 'P', 'Amazon.com', 1, 12.5)
  ]));
  assert.equal(jump.trend.pct, 25);
});

test('buildAggregates breaks down by format with canonical labels and shares', () => {
  const agg = norm(buildAggregates(FIXTURE));
  const fmt = new Map(agg.byFormat.map(k => [k.key, k]));
  assert.equal(agg.byFormat[0].key, 'Paperback', 'Paperback leads');
  approx(fmt.get('Paperback').total, 43.08, 'Paperback = 43.08');
  assert.equal(fmt.get('Paperback').count, 5);
  approx(fmt.get('Kindle (eBook)').total, 9.64);
  const sumPct = agg.byFormat.reduce((s, b) => s + b.pct, 0);
  assert.ok(Math.abs(sumPct - 100) < 0.15, 'shares sum to ~100%, got ' + sumPct);
  assert.equal(fmt.get('Paperback').pct, round1(43.08 / 52.72 * 100));
});

test('buildAggregates breaks down by marketplace, including an Other bucket', () => {
  const agg = norm(buildAggregates(FIXTURE));
  const mkt = new Map(agg.byMarketplace.map(k => [k.key, k]));
  assert.deepEqual(agg.byMarketplace[0].key, 'Amazon.com');
  approx(mkt.get('Amazon.com').total, 28.72);
  approx(mkt.get('Amazon.co.uk').total, 7.23);
  approx(mkt.get('Amazon.de').total, 14.36);
  approx(mkt.get('Other').total, 2.41, 'blank marketplace lands in Other');
  assert.equal(mkt.get('Amazon.com').count, 4);
});

test('buildAggregates groups per book', () => {
  const agg = norm(buildAggregates(FIXTURE));
  const books = new Map(agg.byBook.map(k => [k.key, k]));
  assert.equal(agg.byBook[0].key, 'Alpha');
  approx(books.get('Alpha').total, 23.95);
  assert.equal(books.get('Alpha').count, 4);
  approx(books.get('Beta').total, 21.59);
  assert.equal(books.get('Gamma').count, 1);
  assert.equal(books.get('Gamma').units, 1);
});

test('buildAggregates snapshots years with 12-month maps and YoY change', () => {
  const agg = norm(buildAggregates(FIXTURE));
  assert.deepEqual(norm(agg.years.map(y => y.year)), ['2025', '2026']);
  const y25 = agg.years[0];
  const y26 = agg.years[1];
  approx(y25.total, 14.41);
  approx(y25.months[0], 7.18);
  approx(y25.months[2], 7.23);
  assert.equal(y25.months.filter(v => v !== 0).length, 2);
  approx(y26.total, 38.31);
  approx(y26.months[1], 16.77);
  assert.equal(y25.pct, null, 'first year has no prior to compare');
  assert.ok(Math.abs(y26.pct - 165.9) < 0.1, '2026 grows ~165.9% over 2025, got ' + y26.pct);
});

test('buildAggregates handles empty and malformed records defensively', () => {
  const empty = norm(buildAggregates([]));
  assert.equal(empty.grandTotal, 0);
  assert.equal(empty.count, 0);
  assert.equal(empty.bestMonth, null);
  assert.equal(empty.trend, null);
  assert.deepEqual(empty.months, []);
  assert.equal(empty.byFormat.length, 0);
  assert.equal(empty.years.length, 0);
  const weird = norm(buildAggregates([
    { id: 'a', date: 'garbage', title: 'Ghost', format: 'Paperback', marketplace: 'X', units: 1, royalty: 5 },
    { id: 'b', date: '2026-01-01', title: 'NoRoyalty', format: 'Paperback', marketplace: 'X', units: 1 }
  ]));
  assert.equal(weird.count, 0);
  assert.equal(weird.grandTotal, 0);
});

test('distinctYears and latestYear', () => {
  assert.deepEqual(norm(distinctYears(FIXTURE)), ['2025', '2026']);
  assert.deepEqual(norm(distinctYears([])), []);
  assert.equal(latestYear(FIXTURE), '2026');
  assert.equal(latestYear([]), null);
});

/* ---------- display formatting ---------- */

test('fmtMoney formats with grouping and a leading minus sign', () => {
  assert.equal(fmtMoney(0, '$'), '$0.00');
  assert.equal(fmtMoney(7.18, '$'), '$7.18');
  assert.equal(fmtMoney(1234.56, '$'), '$1,234.56');
  assert.equal(fmtMoney(1234567.89, '$'), '$1,234,567.89');
  assert.equal(fmtMoney(-3.4, '$'), '-$3.40');
  assert.equal(fmtMoney(2.41, '£'), '£2.41');
  assert.equal(fmtMoney(12.5, ''), '12.50');
  assert.equal(fmtMoney(-0.004, '$'), '$0.00');
  assert.equal(fmtMoney(null, '$'), '$0.00');
});

test('fmtInt, round1, pctChangeNum, monthLabel helpers', () => {
  assert.equal(fmtInt(0), '0');
  assert.equal(fmtInt(1234567), '1,234,567');
  assert.equal(fmtInt(-9), '-9');
  assert.equal(round1(14.36), 14.4);
  assert.equal(round1(-14.36), -14.4);
  assert.equal(round1(1.46), 1.5);
  assert.equal(pctChangeNum(0, 10), null);
  assert.equal(pctChangeNum(10, 15), 50);
  assert.equal(pctChangeNum(100, 75), -25);
  assert.equal(monthLabel('2026-03'), 'Mar 2026');
  assert.equal(monthLabel('2025-01'), 'Jan 2025');
});

/* ---------- round trip ---------- */

test('recordsToCsv escapes and re-imports losslessly', () => {
  const tricky = [
    rec('2026-01-05', 'Mine, Mostly "the good one"', 'Paperback', 'Amazon.com', 2, 7.18),
    rec('2026-02-11', 'Newlines\nin title', 'Kindle (eBook)', 'Amazon.co.uk', null, 2.41),
    rec('2026-03-03', 'Quote"field', 'Hardcover', 'Amazon.de', 1, 0)
  ];
  const csv = recordsToCsv(tricky);
  const res = norm(parseKdpCsv(csv));
  assert.equal(res.skipped.length, 0, 'export should never be skipped on re-import');
  assert.equal(res.records.length, 3);
  const bare = r => ({ date: r.date, title: r.title, format: r.format, marketplace: r.marketplace, units: r.units, royalty: r.royalty });
  assert.deepEqual(norm(res.records.map(bare)), tricky.map(bare));
  assert.match(csv, /^Date,Title,Format,Marketplace,Units,Royalty/);
});

test('csvEscape quotes only when needed and doubles inner quotes', () => {
  assert.equal(csvEscape('plain'), 'plain');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape('line\nbreak'), '"line\nbreak"');
  assert.equal(csvEscape(null), '');
});

test('templateCsv is itself a valid import; makeId produces ids', () => {
  const res = norm(parseKdpCsv(templateCsv()));
  assert.equal(res.headerFound, true);
  assert.equal(res.records.length, 2);
  assert.equal(res.records[0].title, 'The Massive AI Manual');
  assert.equal(res.records[1].marketplace, 'Amazon.co.uk');
  assert.ok(makeId().length > 10);
});
