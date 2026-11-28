// My Team court: slot rows by formation, the empty slot, the court card (same shape for everyone, nothing drawn without data) and the lines without zones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { courtHtml, courtCardHtml, benchHtml } from '../../site/fantasy/my-team/court-view.js';
import { courtPlayer } from '../../site/fantasy/my-team/team-page.js';
import { FORMATIONS, emptyTeam, positionsOf } from '../../site/core/team-model.js';

const player = {
  fullName: 'Sasha Vezenkov', name: 'S. Vezenkov', portrait: 'assets/players/x.webp', pos: 'F', teamCode: 'OLY',
  next: { home: false, code: 'BAY' }, info: { cr: 14.2, value: 1.3, valueSeries: [1, 2, 3] }, pir: '18.4', min: '27.1',
};
const rowsOf = html => [...html.matchAll(/data-position-row="(\w)"/g)].map(m => m[1]);

test('every formation: centres on top, guards at the bottom, five slots with the labels of their rows', () => {
  for (const f of FORMATIONS) {
    const html = courtHtml(emptyTeam('T', f), () => null);
    assert.deepEqual(rowsOf(html), ['C', 'F', 'G']);
    assert.equal(html.match(/data-slot="starters:\d"/g).length, 5);
    for (const [pos, label] of [['G', 'GUARD'], ['F', 'FORWARD'], ['C', 'CENTER']])
      assert.equal(html.split(`>${label}<`).length - 1, positionsOf(f).filter(p => p === pos).length, `${f} ${pos}`);
  }
  assert.match(courtHtml(emptyTeam('T', '2-1-2'), () => null), /<button type="button" data-part="fantasy\.my-team\.empty-slot" data-slot="starters:3" aria-label="Add a center">/);
});

test('a filled slot shows the player where the slot is; the others stay empty', () => {
  const team = { ...emptyTeam('T', '2-1-2'), starters: [null, null, 'f', null, null] };
  const html = courtHtml(team, () => player);
  assert.equal(html.match(/fantasy\.my-team\.court-card"/g).length, 1);
  assert.equal(html.match(/fantasy\.my-team\.empty-slot"/g).length, 4);
  assert.ok(html.indexOf('data-slot="starters:2"') > html.indexOf('data-position-row="F"'));
});

test('court card: fade of the public team code, badge, name, next opponent, CR, Value without sparkline, PIR and MIN', () => {
  const html = courtCardHtml(player, '');
  assert.ok(html.includes('data-part="fantasy.player-card.header-portrait-fade"') && html.includes('--fantasy-team-colour-primary-OLY'));
  assert.ok(html.includes('name-cell-position-badge') && html.includes('title="Sasha Vezenkov">S. Vezenkov<'));
  assert.ok(html.includes('>@ BAY<') && html.includes('name-cell-cr-box') && html.includes('>14.2<') && html.includes('name-cell-value-chip'));
  assert.ok(!html.includes('name-cell-sparkline'));
  assert.ok(html.includes('>PIR</span>18.4<') && html.includes('>MIN</span>27.1<'));
  assert.ok(courtCardHtml({ ...player, next: { home: true, code: 'ASV' } }, '').includes('>vs ASV<'));
});

test('without data the figures and the opponent are empty, and the card keeps the same elements', () => {
  const html = courtCardHtml({ ...player, next: null, info: null, portrait: null, pir: '—', min: '—' }, '');
  assert.ok(!html.includes('cr-box') && !html.includes('value-chip') && !html.includes('<img') && !/>(vs|@) /.test(html));
  for (const key of ['card-frame', 'card-strip', 'card-panel', 'card-next-row', 'card-figures', 'card-stats']) assert.ok(html.includes(`fantasy.my-team.${key}"`), key);
});

test('the court has its painted lines and no shot zones', () => {
  const html = courtHtml(emptyTeam('T'), () => null);
  assert.ok(html.includes('<svg viewBox="5 24 450 420"') && html.includes('<path d="M') && html.includes('<circle '));
  assert.ok(!/sz-borders|sz-zone|stroke-dasharray/.test(html));
});

test('the court card data of a player the files do not know does not break', () => {
  const p = courtPlayer('P0', { roster: { players: {}, teams: {} }, season: { row: () => null, get: () => null }, nextOf: new Map() });
  assert.deepEqual([p.fullName, p.name, p.portrait, p.next, p.info, p.pir, p.min], ['P0', 'P0', null, null, null, '—', '—']);
});

test('the court and the card around it never share a part name (one name, one look)', async () => {
  const site = rel => readFileSync(new URL('../../site/' + rel, import.meta.url), 'utf8');
  const keys = file => new Set([...site(file).matchAll(/part\('([\w-]+)'\)/g)].map(m => m[1]));
  const card = keys('fantasy/my-team/team-card.js'), court = keys('fantasy/my-team/court-view.js'), gallery = keys('fantasy/my-team/gallery-view.js');
  assert.ok(card.size > 5 && court.size > 10);
  assert.deepEqual([...court].filter(k => card.has(k) || gallery.has(k)), []);
});

test('bench: six labelled slots in order; empty ones are buttons with a plus, filled ones are the court card', () => {
  const team = { ...emptyTeam('T'), bench: ['six', null, 'b', null, null, null] };
  const html = benchHtml(team, () => player);
  assert.deepEqual([...html.matchAll(/fantasy\.my-team\.bench-label">([^<]+)</g)].map(m => m[1]), ['6TH MAN', 'BENCH', 'BENCH', 'BENCH', 'BENCH', 'COACH']);
  assert.deepEqual([...html.matchAll(/data-slot="bench:(\d)"/g)].map(m => +m[1]), [0, 1, 2, 3, 4, 5]);
  assert.equal(html.match(/fantasy\.my-team\.court-card"/g).length, 2);
  assert.equal(html.match(/fantasy\.my-team\.bench-empty"/g).length, 3);
  assert.ok(html.includes('aria-label="Add a bench player"'));
  assert.ok(benchHtml(emptyTeam('T'), () => null).includes('aria-label="Add a 6th man"'));
});

test('the coach slot is only an empty state, even if something is stored in it', () => {
  const html = benchHtml({ ...emptyTeam('T'), bench: [null, null, null, null, null, 'someone'] }, () => { throw new Error('no coach data is read'); });
  assert.match(html, /<div data-part="fantasy\.my-team\.bench-coach" data-slot="bench:5"><span data-part="fantasy\.my-team\.bench-note">No data yet</);
  assert.ok(!html.includes('court-card'));
});

test('the bench is as wide as the court through one token', () => {
  const css = readFileSync(new URL('../../site/theme/fantasy/my-team.css', import.meta.url), 'utf8');
  for (const key of ['court', 'bench']) assert.match(css, new RegExp(`\\[data-part="fantasy\\.my-team\\.${key}"\\]\\{[^}]*width:var\\(--fantasy-my-team-court-width\\)`), key);
});

test('a filled slot has two buttons side by side: open the player card, and remove; the slot itself is not a button', () => {
  const html = courtCardHtml(player, 'data-slot="starters:0"');
  assert.match(html, /^<div data-part="fantasy\.my-team\.court-card" data-slot="starters:0">/);
  assert.equal(html.match(/<button /g).length, 2);
  assert.ok(!/<button(?:(?!<\/button>)[\s\S])*<button/.test(html), 'no button inside a button');
  assert.ok(html.includes('aria-label="Open the player card of Sasha Vezenkov"') && html.includes('aria-label="Remove Sasha Vezenkov from the team"'));
});

test('the team card opens the existing player card and adds nothing to it', () => {
  const site = rel => readFileSync(new URL('../../site/' + rel, import.meta.url), 'utf8');
  assert.match(site('fantasy/my-team/team-page.js'), /import\('\.\.\/cards\/card\.js'\)\)\.open\('players', id, \{ previous: trigger \}\)/);
  assert.ok(!site('fantasy/cards/card.js').includes('my-team') && !site('fantasy/cards/card-header.js').includes('my-team'));
});
