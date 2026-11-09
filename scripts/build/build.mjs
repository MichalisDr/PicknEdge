// data/raw -> data/clean.   Usage: node scripts/build/build.mjs [--season E2026]
// Writes player_games.csv, team_games.csv, shots.csv, players.csv, schema.json and prints a quality report.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGame, toCsv, PLAYER_COLUMNS, TEAM_COLUMNS, SHOT_COLUMNS } from './clean.mjs';
import { auditPir } from './audit.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const season = arg('season', 'E2026');
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rawDir = join(repo, 'data', 'raw', season), outDir = join(repo, 'data', 'clean');
const readGz = f => JSON.parse(gunzipSync(readFileSync(f)));

const PLAYER_DIM_COLUMNS = ['player_id', 'player', 'team', 'position_feed', 'position_override', 'position', 'dorsal', 'height', 'active']
  .map(name => ({ name, src: 'roster (feeds API) + data/manual/fantasy-position-overrides.json' }));

function playersDim(playerRows) {
  const POS = { Guard: 'G', Forward: 'F', Center: 'C' };
  const slug = n => { const [last, first] = String(n).split(',').map(s => s.trim()); return [first, last].filter(Boolean).join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  const overrideFile = join(repo, 'data', 'manual', 'fantasy-position-overrides.json');
  const overrides = existsSync(overrideFile) ? JSON.parse(readFileSync(overrideFile, 'utf8')) : {};
  const dim = new Map();
  const rosterFile = join(rawDir, 'roster.json.gz');
  if (existsSync(rosterFile)) {
    const roster = readGz(rosterFile);
    for (const [team, list] of Object.entries(roster.people)) for (const x of list) {
      if (x.type !== 'J' || !x.person?.code) continue;
      const id = 'P' + String(x.person.code).trim(), old = dim.get(id);
      if (old?.active && !x.active) continue;                       // keep the active club entry for players listed twice
      dim.set(id, { player_id: id, player: x.person.name, team, position_feed: POS[x.positionName] || '', dorsal: x.dorsal ?? '', height: x.person.height ?? '', active: x.active ? 1 : 0 });
    }
  }
  for (const r of playerRows) if (!dim.has(r.player_id)) dim.set(r.player_id, { player_id: r.player_id, player: r.player, team: r.team, position_feed: '', dorsal: r.dorsal, height: '', active: 0 });
  return [...dim.values()].map(d => {
    const ov = overrides[slug(d.player)] || '';
    return { ...d, position_override: ov, position: ov || d.position_feed };
  }).sort((a, b) => a.player_id.localeCompare(b.player_id));
}

const codes = readdirSync(rawDir).filter(d => /^\d+$/.test(d)).map(Number).sort((a, b) => a - b);
const players = [], teams = [], shots = [], checks = [];
for (const code of codes) {
  const d = join(rawDir, String(code));
  const g = buildGame(season, code, Object.fromEntries(['game', 'boxscore', 'playbyplay', 'shots'].map(n => [n, readGz(join(d, n + '.json.gz'))])));
  players.push(...g.players); teams.push(...g.teams); shots.push(...g.shots); checks.push(g.checks);
}
const dim = playersDim(players);

mkdirSync(outDir, { recursive: true });
const write = (name, columns, rows) => writeFileSync(join(outDir, name), toCsv(columns, rows));
write('player_games.csv', PLAYER_COLUMNS, players);
write('team_games.csv', TEAM_COLUMNS, teams);
write('shots.csv', SHOT_COLUMNS, shots);
write('players.csv', PLAYER_DIM_COLUMNS, dim);
writeFileSync(join(outDir, 'schema.json'), JSON.stringify({ player_games: PLAYER_COLUMNS, team_games: TEAM_COLUMNS, shots: SHOT_COLUMNS, players: PLAYER_DIM_COLUMNS }, null, 1) + '\n');

// ---- quality report ----
const n = checks.length, cnt = f => checks.filter(f).length;
console.log(`clean: ${n} games -> ${players.length} player rows, ${teams.length} team rows, ${shots.length} shots, ${dim.length} players`);
console.log(`possession fallback (Oliver): ${cnt(c => !c.possOk)} of ${n} games` + (cnt(c => !c.possOk) ? ` -> ${checks.filter(c => !c.possOk).map(c => `${c.game}${c.fgaOk ? '' : '[fga]'}${c.countOk ? '' : '[count]'}`).join(', ')}` : ''));
console.log(`lineups verified (on_ok): ${cnt(c => c.possOk && c.onOk)} of ${n} games` + (cnt(c => c.possOk && !c.onOk) ? ` -> failed: ${checks.filter(c => c.possOk && !c.onOk).map(c => `${c.game} (${c.onBad.slice(0, 3).join(' ')})`).join('; ')}` : ''));
console.log(`shots feed agrees with box score: ${cnt(c => c.shotsOk)} of ${n} games`);
const rebBad = checks.filter(c => Object.keys(c.pbpReb).some(t => c.pbpReb[t].join() !== c.boxReb[t].join()));
console.log(`play-by-play rebounds (OR,DR) equal box totals: ${n - rebBad.length} of ${n} games` + (rebBad.length ? ` -> differ: ${rebBad.slice(0, 8).map(c => c.game).join(', ')}${rebBad.length > 8 ? ', …' : ''}` : ''));
// Invariants: each team has 5 players on court at any time, so on-court sums are 5x the team figure.
const inv = { rows: 0, bad: [] };
for (const t of teams) {
  const ps = players.filter(p => p.game === t.game && p.team === t.team && p.on_ok === 1);
  if (!ps.length) continue;
  inv.rows++;
  const s = k => ps.reduce((n, p) => n + p[k], 0);
  const miss = [['poss_off_on', 5 * t.poss_pbp], ['team_sa_on', 5 * t.sa], ['team_oreb_on', 5 * t.oreb], ['team_dreb_on', 5 * t.dreb], ['team_tov_on', 5 * t.tov], ['team_fgm_on', 5 * (t.m2 + t.m3)], ['on_sec', 5 * t.sec]]
    .filter(([k, want]) => Math.abs(s(k) - want) > (k === 'on_sec' ? 5 * 75 : 0));
  if (miss.length) inv.bad.push(`g${t.game} ${t.team}: ${miss.map(([k, w]) => `${k} ${s(k)} vs ${w}`).join(', ')}`);
}
console.log(`on-court sums = 5 x team figures (possessions, SA, OREB, DREB, TOV, seconds): ${inv.rows - inv.bad.length} of ${inv.rows} team-games` + (inv.bad.length ? `; first failures: ${inv.bad.slice(0, 5).join(' | ')}` : ''));
const linked = teams.filter(t => t.assists_linked).length, made = shots.filter(s => /^[23]FGM$/.test(s.action));
console.log(`assist attribution linked: ${linked} of ${teams.length} team-games; made FGs assisted ${made.filter(s => s.assisted === 1).length}, unassisted ${made.filter(s => s.assisted === 0).length}, unknown ${made.filter(s => s.assisted === null).length}`);
const audit = auditPir(players);
console.log(`PIR vs official valuation (played rows): ${audit.match} of ${audit.total} match` + (audit.bad.length ? `; mismatches: ${audit.bad.slice(0, 10).map(b => `g${b.game} ${b.player_id} ours ${b.ours} official ${b.official}`).join('; ')}${audit.bad.length > 10 ? ' …' : ''}` : ''));
