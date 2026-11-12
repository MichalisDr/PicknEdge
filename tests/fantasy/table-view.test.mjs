// The Fantasy tables page, drawn from the generated data: one Shooting toggle, no Colours button, no GP column, rank chips, one-line headers, fixed numeric columns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { useRealData, siteFile } from '../helpers/site-data.mjs';

globalThis.document = { addEventListener() {}, createElement: () => ({}), body: {} };
globalThis.window = { addEventListener() {} };
useRealData();
const { state } = await import('../../site/fantasy/tables/table-state.js');
const { loadTable } = await import('../../site/fantasy/tables/table-data.js');
const { tableHtml } = await import('../../site/fantasy/tables/table-view.js');
const { mount } = await import('../../site/fantasy/tables/table-page.js');

globalThis.fetch = async u => ({ ok: true, json: async () => JSON.parse(siteFile('config/table-layouts.json')) });
const widthsOf = names => names.map(n => n.length * 8);
async function render(over) {
  Object.assign(state, { entity: 'teams', view: 'profile', win: 'season', position: 'ALL', query: '', minMin: 0, minGp: 1, team: '', filters: false, showAll: false, sort: '', dir: 'desc', sel: [], mode: 'table' }, over);
  const M = await loadTable(state, widthsOf, () => false);
  return { M, html: tableHtml(state, M) };
}

test('one "Shooting" toggle instead of the two-button Profile/Shooting switch; the page opens in Profile', async () => {
  const profile = await render({});
  assert.match(profile.html, /data-view-toggle aria-pressed="false">Shooting</);
  assert.ok(!/data-view="/.test(profile.html));
  const shooting = await render({ view: 'shooting' });
  assert.match(shooting.html, /data-view-toggle aria-pressed="true">Shooting</);
  assert.notDeepEqual(shooting.M.cols.map(c => c.metric), profile.M.cols.map(c => c.metric), 'the toggle switches the columns');
  state.view = 'shooting';
  mount({ innerHTML: '', isConnected: false }, 'teams');
  assert.equal(state.view, 'profile', 'mounting the page always opens in Profile');
});

test('no Colours button and no switch: evaluation colours are always on', async () => {
  const { html } = await render({});
  assert.ok(!/Colours|data-colours/.test(html));
  assert.match(html, /style="color:var\(--eval-(good|bad)-text\)"/, 'values in the best and worst quarter are coloured');
});

test('no GP column, no subtitle or credits slot in the first column, no sub-lines in cells', async () => {
  for (const entity of ['teams', 'players']) {
    const { html, M } = await render({ entity });
    assert.ok(!/fw-gp|>GP<|fw-cr-slot|fw-sub|fw-cov|fw-tm/.test(html), entity);
    assert.ok(!M.cols.some(c => c.metric === 'gp'));
    assert.match(html, /<th><button class="fw-name"[^>]*>[^<]+<\/button>/);
  }
  const { html } = await render({ entity: 'players' });
  assert.match(html, /<small class="fw-who" title="[^"]*">[A-Z]{3} · [GFC]<\/small>/, 'second line of a player: team code (Euroleague Fantasy code) and position');
  assert.ok(!(await render({ entity: 'teams' })).html.includes('fw-who'), 'team rows have no second line');
});

test('a cell is the value and a rank chip (two lines at most)', async () => {
  const { html } = await render({});
  assert.match(html, /<span class="fw-cell" data-id="[^"]+" data-metric="[^"]+" (data-chart )?tabindex="0"><span class="fw-v"[^>]*>[^<]+<\/span><i class="fw-rk">#\d+<\/i><\/span>/);
});

test('headers stay sortable buttons with the metric description; the sorted column is marked', async () => {
  const { html, M } = await render({});
  assert.equal((html.match(/<button data-sort="/g) || []).length, M.cols.length);
  assert.match(html, /aria-sort="(ascending|descending)"/);
  assert.match(html, /class="fw-n fw-sorted"/);
});

test('the table fills its container: numeric columns share the rest equally above a minimum width', async () => {
  const { html, M } = await render({});
  const cols = html.match(/<colgroup>(.*?)<\/colgroup>/)[1];
  assert.match(cols, /^<col style="width:\d+px">(<col>){1,}$/, 'only the first column carries a width');
  assert.equal((cols.match(/<col>/g) || []).length, M.cols.length);
  assert.match(html, /<table class="fw-t" style="min-width:\d+px">/);
});

test('hover and click on a main value: cells carry the entity and metric, charts are offered on the main metrics', async () => {
  const { html } = await render({});
  assert.match(html, /data-chart tabindex="0"/);
  assert.match(html, /class="sz-pop fw-pop"/);
});

test('table stylesheet and scripts use theme variables only: no zebra, no raw colours', () => {
  const css = siteFile('theme/fantasy/table.css');
  assert.ok(!/nth-child\((even|odd|2n)/.test(css), 'no alternating row background');
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) || [], []);
  const dir = new URL('../../site/fantasy/tables/', import.meta.url);
  for (const f of readdirSync(dir)) assert.deepEqual(readFileSync(new URL(f, dir), 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) || [], [], f);
});
