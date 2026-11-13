// Arrangement (config/arrangement.json): order of parts, direction, alignment and visibility of the Fantasy toolbar, the Players/Teams name cell and the player card header.
// The view code only says how to draw each part; changing the config changes the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ARRANGEMENT from '../../site/config/arrangement.json' with { type: 'json' };
import { buildArrangementCss } from '../../site/config/generate.mjs';
import { useRealData } from '../helpers/site-data.mjs';

globalThis.document = { addEventListener() {}, createElement: () => ({}), body: {} };
globalThis.window = { addEventListener() {} };
useRealData();
const { Data } = await import('../../site/core/data.js');
const { state } = await import('../../site/fantasy/tables/table-state.js');
const { loadTable } = await import('../../site/fantasy/tables/table-data.js');
const { tableHtml } = await import('../../site/fantasy/tables/table-view.js');
const { headerHtml, controlsHtml } = await import('../../site/fantasy/cards/card-header.js');

const SITE = new URL('../../site/', import.meta.url);
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL('config/table-layouts.json', SITE), 'utf8')) });
async function table(entity) {
  Object.assign(state, { entity, view: 'profile', win: 'season', position: 'ALL', query: '', minMin: 0, minGp: 1, team: '', filters: false, showAll: false, sort: '', dir: 'desc', sel: [], mode: 'table' });
  return tableHtml(state, await loadTable(state, names => names.map(n => n.length * 8), () => false));
}
const at = (html, parts) => parts.map(p => html.indexOf(p));
const inOrder = idx => idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1]));

test('arrangement.css is exactly what arrangement.json generates', () => {
  assert.equal(readFileSync(new URL('config/arrangement.css', SITE), 'utf8'), buildArrangementCss(ARRANGEMENT), 'run: node site/config/generate.mjs');
});

test('toolbar: parts in the configured order, the end group at the far end, optional parts only when they apply', async () => {
  const players = await table('players');
  assert.ok(inOrder(at(players, ['aria-label="Sample window"', 'data-view-toggle', 'data-position="ALL"', 'class="fw-right"', 'data-filters', 'type="search"'])));
  const teams = await table('teams');
  assert.ok(!teams.includes('data-position') && !teams.includes('data-filters'), 'players-only parts are not drawn for teams');
  assert.ok(inOrder(at(teams, ['data-view-toggle', 'class="fw-right"', 'type="search"'])));
});

test('changing the order in the config changes the page (toolbar, name cell, card header)', async () => {
  const saved = JSON.stringify(ARRANGEMENT);
  try {
    const tb = ARRANGEMENT.component.fantasy['stat-table'].toolbar.parts; tb.reverse();
    const reversed = await table('players');
    assert.ok(reversed.indexOf('data-position="ALL"') < reversed.indexOf('data-view-toggle'), 'the start parts follow the config order');
    ARRANGEMENT.component.fantasy['stat-table'].toolbar.parts = JSON.parse(saved).component.fantasy['stat-table'].toolbar.parts;
    const nc = ARRANGEMENT.component.fantasy['stat-table']['name-cell'].parts; nc.reverse();
    const cell = await table('players');
    assert.ok(cell.indexOf('class="fw-who"') < cell.indexOf('class="fw-name"'), 'name cell order follows the config');
    ARRANGEMENT.component.fantasy['stat-table']['name-cell'].parts = JSON.parse(saved).component.fantasy['stat-table']['name-cell'].parts;
    const ctx = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, roster: { teams: { AAA: 'Alpha' } }, logo: 'assets/logos/x.png', next: null };
    const before = headerHtml(ctx);
    assert.ok(before.indexOf('<img') < before.indexOf('<h2>'));
    ARRANGEMENT.component.fantasy['player-card'].header.parts.reverse();
    const after = headerHtml(ctx);
    assert.ok(after.indexOf('<h2>') < after.indexOf('<img'), 'header order follows the config');
  } finally { Object.assign(ARRANGEMENT, JSON.parse(saved)); }
});

test('optional parts (cr box, value chip) draw nothing while there is no data, and appear when there is', async () => {
  assert.equal(Data.fantasyInfo('anyone'), null);
  assert.ok(!(await table('players')).includes('fw-cr-box'));
  const ctx = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, roster: { teams: { AAA: 'Alpha' } }, logo: null, next: null };
  assert.ok(!headerHtml(ctx).includes('fw-cr-box'));
  const saved = Data.fantasyInfo; Data.fantasyInfo = () => ({ cr: 12.5, value: 3.1 });
  try {
    assert.ok(headerHtml(ctx).includes('fw-cr-box') && headerHtml(ctx).includes('fw-value-chip'));
    const html = await table('players');
    assert.ok(html.includes('fw-cr-box') && html.includes('fw-value-chip'));
    assert.ok(!(await table('teams')).includes('fw-cr-box'), 'team rows have no cr box');
  } finally { Data.fantasyInfo = saved; }
});

test('controls row: window buttons, games played, Shooting in the configured order', () => {
  const html = controlsHtml({ cs: { mode: 'profile', win: 'season' }, players: true, gp: 7 });
  assert.ok(inOrder(at(html, ['aria-label="Sample window"', '<b>7 GP</b>', 'aria-label="Card view"'])));
});

test('order, direction and alignment of these components are not hard-coded in the style sheets', () => {
  const classes = ['.fw-toolbar', '.fw-right', '.fw-identity', '.fw-card-controls', '.fw-namecell', '.fw-periods', '.fw-name'];
  const walk = (dir, out = []) => { for (const e of readdirSync(new URL(dir, SITE), { withFileTypes: true })) { if (e.isDirectory()) { if (e.name !== 'data') walk(dir + e.name + '/', out); } else if (e.name.endsWith('.css') && !/^(theme|sizes|arrangement|editor)\.css$/.test(e.name)) out.push(dir + e.name); } return out; };
  for (const f of walk('')) for (const m of readFileSync(new URL(f, SITE), 'utf8').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!m[1].split(',').some(s => classes.some(c => s.trim().split(/[\s>+~]/).pop().startsWith(c)))) continue;
    for (const d of m[2].split(';')) {
      const [p, v] = [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()];
      if (/^(flex-direction|justify-content|align-items|align-self|flex-wrap|order)$/.test(p) || (p === 'margin-left' && v === 'auto')) assert.match(v, /^var\(--/, `${f}: ${m[1].trim()} { ${p}:${v} }`);
    }
  }
});

test('every part named in the config has a name in the same style as theme.json and sizes.json (screen.component.part)', () => {
  for (const [screen, comps] of Object.entries(ARRANGEMENT.component)) for (const [comp, parts] of Object.entries(comps)) for (const [part, entry] of Object.entries(parts))
    for (const p of entry.parts || []) assert.match(p.name, /^[a-z][a-z-]*$/, `${screen}.${comp}.${part}: ${p.name}`);
});
