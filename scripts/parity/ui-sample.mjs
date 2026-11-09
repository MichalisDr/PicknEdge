// Writes the expected displayed values for the UI gate: a sample of OLD (pre-rebuild) numbers per window, keyed by the names shown in the tables.
// Input: .build-tmp/parity.json (written by scripts/parity/run.mjs). Output: .build-tmp/ui-expected.json (+ a short summary on stdout).
// The browser side (the gate) opens each page, reads the displayed cells and compares them with these numbers rounded as the metric catalog says.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const results = JSON.parse(readFileSync(join(repo, '.build-tmp', 'parity.json'), 'utf8'));
const roster = JSON.parse(readFileSync(join(repo, 'site', 'data', 'roster.json'), 'utf8'));
const metrics = Object.fromEntries(JSON.parse(readFileSync(join(repo, 'site', 'data', 'metrics.json'), 'utf8')).map(m => [m.id, m]));

const FANTASY_PLAYER = ['min', 'usg', 'pts100', 'ast100', 'tov_pct', 'reb100', 'ftr', 'fd100', 'pir'];
const FANTASY_TEAM = ['pace', 'drtg', 'o_efg', 'o_tov100', 'o_ast100', 't_dreb_pct', 'o_ftr', 'o_sc100', 'o_fb100', 'o_pot100'];
const pick = (arr, n) => arr.filter((_, i) => i % Math.max(1, Math.floor(arr.length / n)) === 0).slice(0, n);

const out = { digits: Object.fromEntries(Object.entries(metrics).map(([k, m]) => [k, m.format.digits])), suffix: Object.fromEntries(Object.entries(metrics).map(([k, m]) => [k, m.format.suffix])), players: {}, teams: {}, bettingTeams: { offense: {}, defense: {} } };
const group = (filter, ids) => {
  const by = {};
  for (const r of results.filter(filter)) if (ids.includes(r.id) && r.old !== null) ((by[r.window] ||= {})[r.key] ||= {})[r.id] = r.old;
  return by;
};
const players = group(r => r.entity === 'player', FANTASY_PLAYER);
const keys = pick(Object.keys(players.season || {}).filter(k => players.l3?.[k] && players.l5?.[k]).sort(), 14);
for (const w of ['season', 'l5', 'l3']) out.players[w] = keys.filter(k => players[w]?.[k]).map(k => ({ name: roster.players[k]?.name, v: players[w][k] }));
const teams = group(r => r.entity === 'team', FANTASY_TEAM);
const tkeys = pick(Object.keys(teams.season || {}).sort(), 8);
for (const w of ['season', 'l5', 'l3']) out.teams[w] = tkeys.map(k => ({ name: roster.teams[k], v: teams[w][k] }));
for (const side of ['offense', 'defense']) {
  const ids = [...new Set(results.filter(r => r.entity === 'betting-team-' + side).map(r => r.id))];
  const bt = group(r => r.entity === 'betting-team-' + side, ids);
  for (const w of ['season', 'l10', 'l5', 'l3']) out.bettingTeams[side][w] = tkeys.map(k => ({ name: roster.teams[k], v: bt[w][k] }));
}
writeFileSync(join(repo, '.build-tmp', 'ui-expected.json'), JSON.stringify(out));
const count = o => JSON.stringify(o).length;
console.log(`players ${keys.length} x 3 windows, teams ${tkeys.length} x 3 windows, betting teams ${tkeys.length} x 2 sides x 4 windows; ${count(out)} bytes`);
