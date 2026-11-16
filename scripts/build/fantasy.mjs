// Fantasy credits: raw snapshots (data/raw/<season>/fantasy, written by scripts/fetch/fantasy.mjs) -> our players.
// Library; the CLI that uses it is scripts/build/site-data.mjs. The formulas for value live in scripts/metrics/registry.mjs + engine.mjs, not here.
//
// What the backend's tables mean (checked on the real data: 3536 of 3536 consecutive rows, and the correlations below):
//   round table (matchdays=<id>), one row per player:  quotation = credits IN FORCE FOR THAT ROUND (before the round is played)
//                                                        plus      = change that led into this row's credits (quotation - previous row's quotation);
//                                                                    it follows the performance of the PREVIOUS round (correlation 0.90 with the previous
//                                                                    round's fantasy points, 0.10 with the same round's)
//   current table (no matchday): quotation = credits now = the price for the next round, i.e. after the latest round's change.
// So the credits AFTER round r (what the player costs once round r is in the books, the figure that goes with his stats through r) are
//   after[r] = quotation of round r+1,  and for the latest round = the current table's quotation.
// A player is priced from the first round table he appears in; earlier rounds have no credits (never filled in).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { latestFile, snapshotDir, readSnapshot } from '../fetch/fantasy.mjs';
import { nameParts, displayName } from './names.mjs';

const round1 = x => Math.round(x * 10) / 10;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pagesOf = file => readSnapshot(file).pages;

/** Latest stored snapshots -> { players: [{fid, name, position, team, cr}], rounds: {n: Map(fid -> {before, plus})}, lastRound } or null when nothing is stored. */
export function readFantasy(dir) {
  const cur = latestFile(snapshotDir(dir, 'players', 'all'));
  if (!cur) return null;
  const pages = pagesOf(cur), cols = pages[0].data.columns;
  const ix = Object.fromEntries(['name', 'position', 'team', 'quotation', 'plus'].map(c => [c, cols.indexOf(c)]));
  const players = pages.flatMap(p => p.data.players).map(p => ({ fid: p.id, name: p.row[ix.name], position: p.row[ix.position], team: p.row[ix.team], cr: parseFloat(p.row[ix.quotation]) }));

  const idToRound = new Map();                                        // matchday id -> round number, from the stored trends
  const trendDir = join(dir, 'trend');
  for (const k of existsSync(trendDir) ? readdirSync(trendDir) : []) {
    const f = latestFile(join(trendDir, k));
    if (f) for (const t of readSnapshot(f).data.trend) idToRound.set(t.matchday.id, t.matchday.number);
  }
  const rounds = {};
  const mdDir = join(dir, 'matchday');
  for (const k of existsSync(mdDir) ? readdirSync(mdDir) : []) {
    const f = latestFile(join(mdDir, k)), n = idToRound.get(Number(k));
    if (!f || n === undefined) continue;
    const ps = pagesOf(f), c = ps[0].data.columns, iq = c.indexOf('quotation'), ip = c.indexOf('plus');
    rounds[n] = new Map(ps.flatMap(p => p.data.players).map(p => [p.id, { before: parseFloat(p.row[iq]), plus: parseFloat(p.row[ip]) }]));
  }
  const nums = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const lastRound = nums.at(-1) ?? 0;
  for (let n = 1; n <= lastRound; n++) if (!rounds[n]) throw new Error(`Fantasy history has no table for round ${n} (have ${nums.join(',')}): pull again`);
  return { players, rounds, lastRound };
}

/** Credits after each round (index 0 = round 1), null where unknown. See the header for the meaning. */
export function creditsAfter(fid, fantasy) {
  const { rounds, lastRound, players } = fantasy, out = Array(lastRound).fill(null);
  const first = Object.keys(rounds).map(Number).sort((a, b) => a - b).find(n => rounds[n].has(fid));
  const now = players.find(p => p.fid === fid)?.cr;
  if (first === undefined) { if (Number.isFinite(now) && lastRound) out[lastRound - 1] = now; return out; }   // not in any round table yet: only the price today
  for (let n = first; n < lastRound; n++) {
    const next = rounds[n + 1].get(fid);
    if (next) out[n - 1] = next.before;
  }
  if (Number.isFinite(now)) out[lastRound - 1] = now;                                                    // the latest round: the price today
  return out;
}

/** Match Fantasy players to ours by exact key: team (via the manual code map) + first initial + family name. No guessing:
 *  a key that is not unique on either side, or a team that disagrees, leaves both sides unmatched and listed. */
export function matchPlayers(fantasyPlayers, ours, { fixes = {}, teamCodes = {} } = {}) {
  const keyOf = (team, first, last) => `${team}|${norm(first)[0] || ''}|${norm(last)}`;
  const ourKeys = new Map();
  for (const o of ours) {
    const p = nameParts(o.rawName, fixes) || (() => { const n = displayName(o.rawName, fixes).split(' '); return { first: n.slice(0, -1).join(' '), last: n.at(-1) }; })();
    const k = keyOf(o.team, p.first, p.last);
    (ourKeys.get(k) || ourKeys.set(k, []).get(k)).push(o);
  }
  const theirKeys = new Map(), skipped = [];
  for (const f of fantasyPlayers) {
    if (f.position === 'Head Coach') continue;
    const m = /^\s*([^.\s]+)\.?\s+(.+?)\s*$/.exec(f.name || '');
    const team = teamCodes[f.team];
    if (!m || !team) { skipped.push(f); continue; }
    const k = keyOf(team, m[1], m[2]);
    (theirKeys.get(k) || theirKeys.set(k, []).get(k)).push(f);
  }
  const pairs = new Map(), usedOurs = new Set(), usedTheirs = new Set();
  for (const [k, fs] of theirKeys) {
    const os = ourKeys.get(k);
    if (fs.length === 1 && os?.length === 1) { pairs.set(os[0].id, fs[0].fid); usedOurs.add(os[0].id); usedTheirs.add(fs[0].fid); }
  }
  const unmatchedFantasy = fantasyPlayers.filter(f => f.position !== 'Head Coach' && !usedTheirs.has(f.fid));
  const unmatchedOurs = ours.filter(o => !usedOurs.has(o.id));
  return { pairs, unmatchedFantasy, unmatchedOurs };
}

/** { byPlayer: Map(our id -> {cr, crSeries}), lastRound, match, report: [lines] }: crSeries has one entry per Fantasy round. null when nothing is stored. */
export function fantasyForBuild({ dir, ours, fixes, teamCodes, activeOurs = () => true }) {
  const fantasy = readFantasy(dir);
  if (!fantasy) return null;
  const match = matchPlayers(fantasy.players, ours, { fixes, teamCodes });
  const byPlayer = new Map();
  for (const [id, fid] of match.pairs) {
    const crSeries = creditsAfter(fid, fantasy), cr = fantasy.players.find(p => p.fid === fid)?.cr;
    if (Number.isFinite(cr)) byPlayer.set(id, { cr, crSeries });
  }
  const report = [`fantasy: ${fantasy.players.filter(p => p.position !== 'Head Coach').length} Fantasy players, ${match.pairs.size} matched to ours, rounds 1-${fantasy.lastRound}`];
  const name = f => `${f.name} (${f.team})`;
  if (match.unmatchedFantasy.length) report.push(`fantasy: ${match.unmatchedFantasy.length} Fantasy player(s) with no match in our data (no cr): ${match.unmatchedFantasy.map(name).join('; ')}`);
  const lost = match.unmatchedOurs.filter(o => activeOurs(o));
  if (lost.length) report.push(`fantasy: ${lost.length} of our active player(s) with no Fantasy match (no cr): ${lost.map(o => `${displayName(o.rawName, fixes)} (${o.team})`).join('; ')}`);
  return { byPlayer, lastRound: fantasy.lastRound, match, report };
}
