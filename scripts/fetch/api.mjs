// EuroLeague API access: HTTP with retry + response-shape validation.
// Shape checks throw ShapeError (never retried): if the API changes, we stop loudly.

const LIVE = 'https://live.euroleague.net/api/';
const FEED = 'https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons/';

export class ShapeError extends Error {}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Global throttle: at most one request start per GAP_MS across all workers.
const GAP_MS = 700;
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + GAP_MS;
  if (at > now) await sleep(at - now);
}

/** GET url -> {text, json}. Retries network/5xx/429 with backoff (honours Retry-After); other 4xx fail at once. */
export async function get(url, { retries = 6, timeoutMs = 30000 } = {}) {
  let last, wait = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(Math.max(wait, Math.min(2000 * 2 ** (attempt - 1), 60000)));
    await throttle();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) {
        wait = (Number(res.headers.get('retry-after')) || 0) * 1000;
        if (res.status === 429) nextSlot = Math.max(nextSlot, Date.now() + Math.max(wait, 10000)); // pause all workers
        last = new Error(`HTTP ${res.status} ${url}`); continue;
      }
      if (!res.ok) throw new ShapeError(`HTTP ${res.status} ${url}`);
      const text = await res.text();
      try { return { text, json: JSON.parse(text) }; }
      catch { throw new ShapeError(`Not JSON: ${url} (starts: ${text.slice(0, 80)})`); }
    } catch (e) {
      if (e instanceof ShapeError) throw e;
      last = e;
    }
  }
  throw new Error(`Failed after ${retries + 1} attempts: ${last?.message}`);
}

function need(cond, where, what) {
  if (!cond) throw new ShapeError(`API shape changed at ${where}: ${what}`);
}
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// ---- schedule ------------------------------------------------------------
export async function fetchSchedule(season) {
  // `limit` sets the page size (pageNumber/pageSize are ignored by this feed); one page must hold everything.
  const { json } = await get(`${FEED}${season}/games?limit=1000`);
  need(json.status === 'success' && Array.isArray(json.data), 'schedule', 'status/data');
  need(isObj(json.metadata) && json.metadata.totalPages <= 1 && json.metadata.totalItems === json.data.length, 'schedule.metadata', 'not all games in one page');
  for (const g of json.data) {
    need(Number.isInteger(g.code) && typeof g.status === 'string', 'schedule.game', 'code/status');
    need(isObj(g.home) && isObj(g.away) && typeof g.home.code === 'string', `schedule.game ${g.code}`, 'home/away');
  }
  need(json.data.length === new Set(json.data.map(g => g.code)).size, 'schedule', 'duplicate game codes');
  return json.data;
}

// ---- per-game endpoints --------------------------------------------------
const live = (name, season, code) => `${LIVE}${name}?gamecode=${code}&seasoncode=${season}`;

export const ENDPOINTS = {
  boxscore: { url: (s, c) => live('Boxscore', s, c), check: checkBoxscore },
  playbyplay: { url: (s, c) => live('PlayByPlay', s, c), check: checkPlayByPlay },
  shots: { url: (s, c) => live('Points', s, c), check: checkShots },
};

function checkBoxscore(j, w) {
  need(isObj(j) && j.Live === false, w, 'Live must be false for a finished game');
  need(Array.isArray(j.Stats) && j.Stats.length === 2, w, 'Stats must have 2 teams');
  for (const t of j.Stats) {
    need(Array.isArray(t.PlayersStats) && t.PlayersStats.length > 0, w, 'PlayersStats');
    for (const k of ['Player_ID', 'Team', 'Minutes', 'Points', 'FieldGoalsMade2', 'FieldGoalsAttempted3', 'FreeThrowsAttempted', 'TotalRebounds', 'Assistances', 'Turnovers', 'Plusminus'])
      need(k in t.PlayersStats[0], w, `player field ${k}`);
  }
}
function checkPlayByPlay(j, w) {
  need(isObj(j) && j.Live === false, w, 'Live must be false');
  for (const k of ['FirstQuarter', 'SecondQuarter', 'ThirdQuarter', 'ForthQuarter', 'ExtraTime']) need(Array.isArray(j[k]), w, k);
  const ev = j.FirstQuarter[0];
  need(ev && 'PLAYTYPE' in ev && 'MINUTE' in ev && 'CODETEAM' in ev && 'NUMBEROFPLAY' in ev, w, 'event fields');
}
function checkShots(j, w) {
  need(isObj(j) && Array.isArray(j.Rows) && j.Rows.length > 0, w, 'Rows');
  for (const k of ['ID_ACTION', 'ID_PLAYER', 'TEAM', 'COORD_X', 'COORD_Y', 'ZONE', 'POINTS', 'MINUTE'])
    need(k in j.Rows[0], w, `shot field ${k}`);
}

export const countEvents = pbp => ['FirstQuarter', 'SecondQuarter', 'ThirdQuarter', 'ForthQuarter', 'ExtraTime'].reduce((n, k) => n + pbp[k].length, 0);

/** Cross-check: boxscore player points per team must equal the schedule score. */
export function checkScore(game, box) {
  const sum = code => box.Stats.filter(t => t.PlayersStats[0].Team.trim() === code)
    .reduce((n, t) => n + t.PlayersStats.reduce((m, p) => m + (p.Points || 0), 0), 0);
  const h = sum(game.home.code), a = sum(game.away.code);
  need(h === game.home.score && a === game.away.score, `game ${game.code}`,
    `box points ${h}-${a} != schedule ${game.home.score}-${game.away.score}`);
}
