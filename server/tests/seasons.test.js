// Season phases, rubric maths and validation, and the CSV writer. No database.
const test = require('node:test');
const assert = require('node:assert/strict');
const Season = require('../seasons/Season');
const SeasonEntry = require('../seasons/SeasonEntry');
const { toCsv, cell } = require('../utils/csv');

const d = (s) => new Date(`2026-${s}T00:00:00Z`);
const season = (over = {}) => new Season({
  name: 'Odd Sem 2026 Demo Day', slug: 'odd-sem-2026-demo-day',
  submissionOpens: d('10-01'), submissionCloses: d('10-31'), judgingCloses: d('11-10'), ...over,
});

test('phase follows the dates; publishing results ends it', () => {
  const s = season();
  assert.equal(s.phase(d('09-20')), 'upcoming');
  assert.equal(s.phase(d('10-15')), 'open');
  assert.equal(s.phase(d('11-05')), 'judging');
  assert.equal(s.phase(d('11-20')), 'closed');
  s.resultsPublishedAt = d('11-21');
  assert.equal(s.phase(d('10-15')), 'results');
});

test('season validation: date order and rubric weights', async () => {
  await assert.doesNotReject(season().validate());
  await assert.rejects(season({ submissionCloses: d('09-01') }).validate(), /close after they open/);
  await assert.rejects(season({ judgingCloses: d('10-20') }).validate(), /Judging must end/);
  await assert.rejects(season({ criteria: [{ key: 'a', label: 'A', weight: 60 }] }).validate(), /add up to 100/);
});

test('weighted rubric total out of 100', () => {
  const crit = Season.DEFAULT_CRITERIA;   // 25 / 25 / 30 / 20
  assert.equal(SeasonEntry.weightedTotal({ innovation: 10, impact: 10, execution: 10, presentation: 10 }, crit), 100);
  assert.equal(SeasonEntry.weightedTotal({ innovation: 8, impact: 6, execution: 7, presentation: 9 }, crit), 74);   // 20 + 15 + 21 + 18
  assert.equal(SeasonEntry.weightedTotal({}, crit), 0);
});

test('CSV: BOM, quoting, dates, arrays', () => {
  const csv = toCsv([{ a: 'Hello, "world"', b: ['x', 'y'], c: new Date('2026-10-14T10:00:00Z'), d: 'line1\nline2' }],
    [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }, { key: 'd', label: 'D' }]);
  assert.ok(csv.startsWith('﻿A,B,C,D\r\n'));
  assert.ok(csv.includes('"Hello, ""world"""'));
  assert.ok(csv.includes('x; y'));
  assert.ok(csv.includes('2026-10-14'));
  assert.ok(csv.includes('"line1\nline2"'));
});

test('CSV: spreadsheet formula injection is neutralised', () => {
  assert.equal(cell('=HYPERLINK("http://evil","click")'), '"\'=HYPERLINK(""http://evil"",""click"")"');
  assert.equal(cell('+91 98765'), "'+91 98765");
  assert.equal(cell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(cell('-5'), '-5', 'plain negative numbers stay numbers');
  assert.equal(cell(42), '42');
  assert.equal(cell(null), '');
});
