// site/table-layouts.json: column order and groups of the four tables, one numeric width, default sorts, registry ids.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { METRICS } from '../../scripts/metrics/registry.mjs';
const M = createRequire(import.meta.url)('../../site/table-model.js');
const T = JSON.parse(readFileSync(new URL('../../site/table-layouts.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(METRICS.map(m => [m.id, m]));

const ZONES = ['rim', 'paint', 'corner', 'arc', 'mid'];                       // Mid-range = the area "Mid" (mid-range plus baseline); no separate Baseline
const zp = (pre, z) => `${pre}${z === 'mid' ? 'zm' : 'zs'}_${z}_pct`;
const EXPECT = {
  'players.profile': [['pir'], ['min', 'usg', 'load', 'tov_pct', 'ctov'], ['pts100', 'ast100', 'reb100'], ['ftr', 'fd100']],
  'players.shooting': [['efg', 'fg2_pct', 'fg3_pct', 'ft_pct'], ZONES.map(z => zp('', z))],
  'teams.profile': [['pace', 'drtg'], ['o_efg', 'o_ftr'], ['o_tov100', 'o_ast100', 't_dreb_pct'], ['o_pot100', 'o_fb100', 'o_sc100']],
  'teams.shooting': [['o_efg', 'o_fg2_pct', 'o_fg3_pct'], ZONES.map(z => zp('o_', z))],
};

test('column order and groups follow the locked table design', () => {
  assert.deepEqual(Object.keys(T.tables).sort(), Object.keys(EXPECT).sort());
  for (const [name, groups] of Object.entries(EXPECT)) assert.deepEqual(T.tables[name].groups.map(g => g.map(c => c.metric)), groups, name);
});
test('no Value or Credits column in any table', () => {
  for (const [name, t] of Object.entries(T.tables)) for (const c of t.groups.flat()) assert.ok(!/value|credit/i.test(c.metric + (c.label || '')), `${name}: ${c.metric}`);
});
test('no separate Team column anywhere (the players tables show team and position under the name)', () => {
  assert.ok(!('teamWidth' in T));
  for (const [name, t] of Object.entries(T.tables)) assert.ok(!('teamColumn' in t), name);
});
test('all numeric columns share one minimum width (numWidth, 80 px) and the rest of the container equally; no column sets its own', () => {
  assert.ok(Number.isInteger(T.numWidth) && T.numWidth >= 60);
  assert.equal(T.numWidth, 80);
  assert.ok(M.tableWidth(T, 'players.profile', T.firstCol.cap) <= 1120, 'the minimum width of Players Overview fits the 1440 px content width (1120 px)');
  for (const [name, t] of Object.entries(T.tables)) for (const c of t.groups.flat()) assert.ok(!('w' in c) && !('width' in c), `${name}: ${c.metric} has its own width`);
  const widths = Object.keys(T.tables).map(n => M.tableWidth(T, n, 200) - 200);
  widths.forEach((w, i) => assert.equal(w % T.numWidth, 0, Object.keys(T.tables)[i]));
});
test('metric ids exist in the registry with the right scope; subs and few-shot ids too', () => {
  for (const [name, t] of Object.entries(T.tables)) {
    const scope = name.startsWith('players') ? 'player' : 'team';
    for (const c of t.groups.flat()) {
      const used = [c.metric, c.detail?.made, c.detail?.att, c.detail?.share].filter(Boolean);
      for (const id of used) { assert.ok(byId[id], `${name}: unknown ${id}`); assert.equal(byId[id].scope, scope, `${name}: ${id} scope`); }
      if (c.few) { assert.ok(byId[c.few], c.few); assert.equal(byId[c.few].scope, 'player'); }
      assert.ok(!c.colour || ['rank', 'zone'].includes(c.colour), `${name}: ${c.metric} colour`);
      assert.ok(!('sub' in c), `${name}: ${c.metric} has a sub-line (cells hold the value and the rank chip only)`);
    }
  }
});
test('default sorts: PIR high first, DRtg low first, Opp eFG% low first; every default sort is a column', () => {
  const d = n => T.tables[n].defaultSort;
  assert.deepEqual(d('players.profile'), { metric: 'pir', dir: 'desc' });
  assert.deepEqual(d('teams.profile'), { metric: 'drtg', dir: 'asc' });
  assert.deepEqual(d('teams.shooting'), { metric: 'o_efg', dir: 'asc' });
  for (const [name, t] of Object.entries(T.tables)) {
    const col = t.groups.flat().find(c => c.metric === t.defaultSort.metric);
    assert.ok(col, name);
    assert.equal(t.defaultSort.dir, M.firstDirection(byId[col.metric].direction), `${name}: default sort is the best end first`);
  }
});
test('neutral columns carry no colour; zone colour only on player zones', () => {
  for (const [name, t] of Object.entries(T.tables)) for (const c of t.groups.flat()) {
    if (byId[c.metric].direction === 0) assert.ok(!c.colour, `${name}: ${c.metric} is neutral`);
    if (c.colour === 'zone') assert.ok(name === 'players.shooting' && c.few, name);
  }
  const overview = T.tables['players.profile'].groups.flat().filter(c => c.colour).map(c => c.metric);
  for (const id of ['min', 'usg', 'load', 'ftr']) assert.ok(!overview.includes(id), id);
});
test('zone columns of the player Shooting table carry the few-shots id of their own zone', () => {
  for (const c of T.tables['players.shooting'].groups[1]) assert.equal(c.few, c.metric.replace('_pct', '_a100'));
});
test('Mid-range is the area Mid (mid-range plus baseline): no Baseline column, no FGA/100 column, no GP column anywhere', () => {
  for (const [name, t] of Object.entries(T.tables)) {
    const ids = t.groups.flat().map(c => c.metric);
    assert.ok(!ids.some(id => /_base_|fga100|a2_rate|a3_rate|^gp$|_a100$/.test(id)), name);
    assert.ok(t.groups.flat().every(c => !/baseline|gp$/i.test(c.label)), name);
  }
  assert.ok(T.tables['players.shooting'].groups[1].some(c => c.metric === 'zm_mid_pct' && c.label === 'Mid-range'));
  assert.ok(T.tables['teams.shooting'].groups[1].some(c => c.metric === 'o_zm_mid_pct' && c.label === 'Mid-range'));
});
test('headers are short (one line in one numeric column): at most 14 characters', () => {
  for (const [name, t] of Object.entries(T.tables)) for (const c of t.groups.flat()) assert.ok(c.label && c.label.length <= 14, `${name}: ${c.label}`);
});
test('the hover chart is for main metric columns only: every Profile column and the four FG% columns, never a zone column', () => {
  for (const n of ['players.profile', 'teams.profile']) for (const c of T.tables[n].groups.flat()) assert.equal(c.chart, true, n + ' ' + c.metric);
  const main = { 'players.shooting': ['efg', 'fg2_pct', 'fg3_pct', 'ft_pct'], 'teams.shooting': ['o_efg', 'o_fg2_pct', 'o_fg3_pct'] };
  for (const [n, ids] of Object.entries(main)) {
    assert.deepEqual(T.tables[n].groups[0].filter(c => c.chart).map(c => c.metric), ids, n);
    assert.ok(T.tables[n].groups[1].every(c => !c.chart && c.detail && c.detail.made && c.detail.att), n + ' zones: pop-out detail, no chart');
  }
});
