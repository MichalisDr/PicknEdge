// data/clean (+ raw schedule) -> site/data: everything the site reads. Also regenerates docs/METRICS.md.
// Usage: node scripts/build/site-data.mjs [--out site/data]
// Files: manifest.json, metrics.json, players-<window>.json, teams-<window>.json, roster.json, schedule.json,
//        games/players.json, games/teams.json, shots/<TEAM>.json, engine/*.mjs (the exact modules the tests cover).
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';
import { displayName } from './names.mjs';
import { buildViews, catalog, docsMarkdown, WINDOWS } from './views.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(repo, arg('out', 'site/data'));
const read = f => parseCsv(readFileSync(join(repo, 'data', 'clean', f), 'utf8'));

const positions = read('position_games.csv'), players = read('player_games.csv'), teams = read('team_games.csv'), dim = read('players.csv'), shots = read('shots.csv');
const season = teams[0].season;
const byGame = (a, b) => a.date_utc.localeCompare(b.date_utc) || a.game - b.game;

// start from an empty folder: a file that is no longer produced must not linger
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'games'), { recursive: true }); mkdirSync(join(out, 'shots'), { recursive: true }); mkdirSync(join(out, 'engine'), { recursive: true });
const written = [];
const put = (name, data) => { writeFileSync(join(out, name), typeof data === 'string' ? data : JSON.stringify(data)); written.push(name); };
const table = (columns, rows) => ({ columns, rows: rows.map(r => columns.map(c => r[c])) });

// ---- views (Season / L3 / L5 / L10), with league rows ----
const views = buildViews({ players, teams, dim, positions });
for (const [w, v] of Object.entries(views)) { put(`players-${w}.json`, v.players); put(`teams-${w}.json`, v.teams); put(`positions-${w}.json`, v.positions); }

// ---- metric catalog ----
put('metrics.json', catalog());

// ---- roster ----
const fixes = JSON.parse(readFileSync(join(repo, 'data', 'manual', 'name-fixes.json'), 'utf8')).words;
const names = {};
for (const t of teams) names[t.team] = t.team_name;
const lastTeam = {};
for (const r of [...players].sort(byGame)) lastTeam[r.player_id] = r.team;
put('roster.json', {
  teams: names,
  logoIds: JSON.parse(readFileSync(join(repo, 'data', 'manual', 'team-ids.json'), 'utf8')).ids,
  players: Object.fromEntries(dim.map(d => [d.player_id, { name: displayName(d.player, fixes), rawName: d.player, team: lastTeam[d.player_id] || d.team, pos: d.position, dorsal: d.dorsal, height: d.height, active: d.active }])),
});

// ---- schedule snapshot (fixtures) ----
const scheduleFile = join(repo, 'data', 'raw', season, 'schedule.json.gz');
put('schedule.json', existsSync(scheduleFile) ? gunzipSync(readFileSync(scheduleFile)).toString('utf8') : '[]');

// ---- per-game rows (components), for custom windows, trends and game logs ----
const PLAYER_DROP = new Set(['season', 'player', 'dorsal', 'pir_official']);
const playerCols = Object.keys(players[0]).filter(c => !PLAYER_DROP.has(c));
put('games/players.json', table(playerCols, players.filter(r => r.played).sort(byGame)));
const teamCols = Object.keys(teams[0]).filter(c => c !== 'season' && c !== 'team_name');
put('games/teams.json', table(teamCols, [...teams].sort(byGame)));

// ---- shots by team: what the team took and what it faced (field goals only; free throws have no position) ----
const SHOT_COLS = ['game', 'team', 'player_id', 'action', 'made', 'points', 'x', 'y', 'zone', 'assisted', 'fastbreak', 'second_chance', 'points_off_turnover', 'minute'];
const fg = shots.filter(s => /^[23]FG[AM]$/.test(s.action));
const gamesOfTeam = {};
for (const t of teams) (gamesOfTeam[t.team] ||= new Set()).add(t.game);
for (const [team, games] of Object.entries(gamesOfTeam)) {
  const rows = fg.filter(s => s.team === team || (games.has(s.game) && s.team !== team));
  put(`shots/${team}.json`, table(SHOT_COLS, rows.sort((a, b) => a.game - b.game || a.minute - b.minute)));
}

// ---- engine: the modules the tests cover, served to the browser unchanged ----
for (const f of ['registry.mjs', 'engine.mjs', 'zones.mjs', 'join.mjs', 'matchup.mjs', 'samples.mjs', 'venn.mjs']) { copyFileSync(join(repo, 'scripts', 'metrics', f), join(out, 'engine', f)); written.push('engine/' + f); }

// ---- manifest (no timestamps: an unchanged data set produces identical files) ----
const hash = createHash('sha1');
for (const f of [...written].sort()) hash.update(f).update(readFileSync(join(out, f)));
const last = [...teams].sort(byGame).at(-1);
writeFileSync(join(out, 'manifest.json'), JSON.stringify({
  season, games: new Set(teams.map(t => t.game)).size, lastGame: last.game, lastDate: last.date_utc,
  windows: Object.keys(WINDOWS), version: hash.digest('hex').slice(0, 10),
  eligibility: JSON.parse(readFileSync(join(repo, 'data', 'manual', 'eligibility.json'), 'utf8')),
  files: [...written].sort(),
}, null, 1) + '\n');
written.push('manifest.json');

mkdirSync(join(repo, 'docs'), { recursive: true });
writeFileSync(join(repo, 'docs', 'METRICS.md'), docsMarkdown() + '\n');

// ---- size report ----
let raw = 0, gz = 0;
const rows = written.sort().map(f => { const b = readFileSync(join(out, f)), z = gzipSync(b).length; raw += b.length; gz += z; return [f, b.length, z]; });
const groups = { 'manifest + metrics + roster + schedule': /^(manifest|metrics|roster|schedule)\.json$/, 'views (all 4 windows)': /^(players|teams)-/, 'games/*': /^games\//, 'shots/* (20 teams)': /^shots\//, 'engine/*': /^engine\// };
console.log(`site/data: ${written.length} files, ${(raw / 1024).toFixed(0)} KB raw, ${(gz / 1024).toFixed(0)} KB gzipped`);
for (const [label, re] of Object.entries(groups)) { const m = rows.filter(r => re.test(r[0])); console.log(`  ${label.padEnd(38)} ${String(m.length).padStart(3)} files  ${(m.reduce((n, r) => n + r[1], 0) / 1024).toFixed(0).padStart(5)} KB raw  ${(m.reduce((n, r) => n + r[2], 0) / 1024).toFixed(0).padStart(4)} KB gz`); }
const at = n => rows.find(r => r[0] === n);
console.log(`  at open (default): manifest, metrics, roster, schedule, players-season, teams-season = ${(['manifest.json', 'metrics.json', 'roster.json', 'schedule.json', 'players-season.json', 'teams-season.json'].reduce((n, f) => n + at(f)[2], 0) / 1024).toFixed(0)} KB gz`);
console.log(`  largest shot file: ${Math.max(...rows.filter(r => r[0].startsWith('shots/')).map(r => r[2] / 1024)).toFixed(0)} KB gz`);
