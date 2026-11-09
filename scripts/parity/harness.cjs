// Boots the CURRENT site code (browser globals) in a vm, feeds it the 100 raw games through its own parser,
// and returns the context. Used only by the parity gate; the site files are read, never modified.
const fs = require('node:fs'), vm = require('node:vm'), zlib = require('node:zlib'), path = require('node:path');
const repo = path.join(__dirname, '..', '..');
const readGz = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));

function boot() {
  const c = vm.createContext({ console, Event, CustomEvent: Event, setTimeout: () => {}, addEventListener() {}, dispatchEvent() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, EUROLEAGUE_DATA_DISABLED: true, FANTASY_SHOTS_DISABLED: true });
  c.window = c;
  const load = f => vm.runInContext(fs.readFileSync(path.join(repo, f), 'utf8'), c, { filename: f });
  load('site/team-assets.js'); load('site/euroleague-data.js');
  const consumers = [], orig = c.EuroLeagueData.register;
  c.EuroLeagueData.register = x => { consumers.push(x); return orig(x); };
  c.FANTASY_SHOTS_DISABLED = false;
  for (const f of ['site/betting-live-data.js', 'site/shot-zones.js', 'site/fantasy-live.js', 'site/fantasy-shots.js', 'site/fantasy-metrics.js', 'site/betting-stats.js', 'site/betting-players.js']) { try { load(f); } catch (e) { console.error('load', f, e.message); } }
  return { c, consumers };
}

function feed(season = 'E2026') {
  const { c, consumers } = boot(), E = c.EuroLeagueData, records = E.records();
  for (const k of Object.keys(records)) delete records[k];
  const root = path.join(repo, 'data', 'raw', season);
  const codes = fs.readdirSync(root).filter(d => /^\d+$/.test(d)).map(Number).sort((a, b) => a - b);
  for (const code of codes) {
    const [g, box, pbp, points] = ['game', 'boxscore', 'playbyplay', 'shots'].map(n => readGz(path.join(root, String(code), n + '.json.gz')));
    const x = { code, round: g.round.round, date: g.date, status: g.status, home: g.home.code, away: g.away.code, homeName: g.home.name, awayName: g.away.name, score: [g.home.score, g.away.score] };
    const rec = E.parse(code, x, box, pbp);
    records[code] = rec;
    for (const k of consumers) k.accept?.(code, rec, { PlayByPlay: pbp, Points: points });
  }
  return { c, E, codes };
}
module.exports = { boot, feed };
