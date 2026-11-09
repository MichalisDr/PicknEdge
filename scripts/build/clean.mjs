// Raw game files -> clean rows (components only, no ratios). Pure functions; I/O lives in build.mjs.
import { analyze, oliver } from './pbp.mjs';

const trim = v => String(v ?? '').trim();
const num = v => Number(v) || 0;
const seconds = m => { const [a, b] = trim(m).split(':').map(Number); return Number.isFinite(a) ? a * 60 + (b || 0) : 0; };   // "DNP" -> 0

/* ---------- column definitions: name + where it comes from (also written to data/clean/schema.json) ---------- */
const C = (name, src) => ({ name, src });
const CTX = (extra = []) => [
  C('season', 'folder name'), C('game', 'folder name'), C('round', 'game.round.round'), C('date_utc', 'game.date'),
  C('team', 'game.home/away.code'), C('opp', 'game.home/away.code'), C('home', 'game.home.code == team'), ...extra,
];
const COUNTS = [
  ['m1', 'FreeThrowsMade'], ['a1', 'FreeThrowsAttempted'], ['m2', 'FieldGoalsMade2'], ['a2', 'FieldGoalsAttempted2'],
  ['m3', 'FieldGoalsMade3'], ['a3', 'FieldGoalsAttempted3'], ['oreb', 'OffensiveRebounds'], ['dreb', 'DefensiveRebounds'],
  ['ast', 'Assistances'], ['stl', 'Steals'], ['tov', 'Turnovers'], ['blk', 'BlocksFavour'], ['blk_against', 'BlocksAgainst'],
  ['pf', 'FoulsCommited'], ['fd', 'FoulsReceived'],
];
const ON = ['team_sa_on', 'team_tov_on', 'poss_off_on', 'poss_def_on', 'team_oreb_on', 'team_dreb_on', 'opp_oreb_on', 'opp_dreb_on'];

export const PLAYER_COLUMNS = [
  ...CTX([C('player_id', 'boxscore Stats[].PlayersStats[].Player_ID (trimmed)'), C('player', 'boxscore Player'), C('dorsal', 'boxscore Dorsal'),
    C('starter', 'boxscore IsStarter'), C('played', 'boxscore Minutes != "DNP"'), C('sec', 'boxscore Minutes (mm:ss -> seconds)')]),
  ...COUNTS.map(([n, s]) => C(n, `boxscore ${s}`)),
  C('plus_minus', 'boxscore Plusminus'), C('pir_official', 'boxscore Valuation (audit only)'),
  C('sa', 'playbyplay: own shot attempts + free-throw trips'),
  C('on_ok', 'playbyplay: lineup verified vs box minutes (+ possession checks)'), C('on_sec', 'playbyplay: tracked seconds on court (audit)'),
  ...ON.map(n => C(n, 'playbyplay: counted while the player is on court (empty if on_ok = 0)')),
];
export const TEAM_COLUMNS = [
  ...CTX([C('team_name', 'game.home/away.name'), C('ot_periods', 'game.home.quarters ot1..ot5 not null'), C('sec', '2400 + 300 * ot_periods')]),
  ...['q1', 'q2', 'q3', 'q4', 'ot1', 'ot2', 'ot3', 'ot4', 'ot5'].map(q => C('pts_' + q, `game.<side>.quarters.${q}`)),
  C('pts', 'boxscore Stats[].totr.Points'),
  ...COUNTS.map(([n, s]) => C(n, `boxscore totr.${s}`)),
  C('poss_pbp', 'playbyplay: counted possessions'), C('poss_ok', 'playbyplay count passed its checks'), C('poss', 'poss_pbp if poss_ok, else Oliver estimate'),
  C('poss_src', '"pbp" | "oliver"'), C('sa', 'playbyplay: team shot attempts'), C('pbp_events', 'playbyplay: events used'),
  C('pts_fastbreak', 'shots: POINTS where FASTBREAK=1'), C('pts_second_chance', 'shots: POINTS where SECOND_CHANCE=1'),
  C('pts_off_turnover', 'shots: POINTS where POINTS_OFF_TURNOVER=1'), C('shots_ok', 'shots feed agrees with box score'),
];
export const SHOT_COLUMNS = [
  C('season', 'folder name'), C('game', 'folder name'), C('team', 'shots TEAM'), C('player_id', 'shots ID_PLAYER'), C('action', 'shots ID_ACTION'),
  C('made', 'ID_ACTION ends with M'), C('points', 'shots POINTS'), C('x', 'shots COORD_X'), C('y', 'shots COORD_Y'), C('zone_feed', 'shots ZONE'),
  C('fastbreak', 'shots FASTBREAK'), C('second_chance', 'shots SECOND_CHANCE'), C('points_off_turnover', 'shots POINTS_OFF_TURNOVER'),
  C('minute', 'shots MINUTE'), C('clock', 'shots CONSOLE'), C('num', 'shots NUM_ANOT (= play-by-play NUMBEROFPLAY)'),
];

/** Box-score team entries keyed by team code. */
function boxByTeam(box) {
  const out = {};
  for (const t of box.Stats) out[trim(t.PlayersStats[0].Team)] = t;
  return out;
}

/** One game -> {players, teams, shots, checks}. `raw` = {game, boxscore, playbyplay, shots} parsed JSON. */
export function buildGame(season, code, raw) {
  const { game, boxscore, playbyplay, shots } = raw;
  const codes = [game.home.code, game.away.code], names = { [codes[0]]: game.home.name, [codes[1]]: game.away.name };
  const opp = { [codes[0]]: codes[1], [codes[1]]: codes[0] };
  const quarters = { [codes[0]]: game.home.quarters, [codes[1]]: game.away.quarters };
  const bt = boxByTeam(boxscore);
  if (!bt[codes[0]] || !bt[codes[1]]) throw new Error(`game ${code}: box score teams do not match schedule (${Object.keys(bt)} vs ${codes})`);
  const ot = Object.keys(quarters[codes[0]]).filter(k => /^ot\d$/.test(k) && quarters[codes[0]][k] != null).length;
  const ctx = (team, extra = {}) => ({ season, game: code, round: game.round.round, date_utc: game.date, team, opp: opp[team], home: team === game.home.code ? 1 : 0, ...extra });

  // player lines and team totals from the box score
  const lines = {}, boxLines = {};
  for (const team of codes) {
    lines[team] = bt[team].PlayersStats.map(p => ({
      id: trim(p.Player_ID), name: trim(p.Player), dorsal: trim(p.Dorsal), starter: p.IsStarter ? 1 : 0,
      played: trim(p.Minutes) === 'DNP' || !seconds(p.Minutes) ? 0 : 1, sec: seconds(p.Minutes), p,
    }));
    boxLines[team] = lines[team].filter(l => l.played).map(l => ({ id: l.id, starter: l.starter, sec: l.sec }));
  }
  const tot = {};
  for (const team of codes) { const t = bt[team].totr; tot[team] = Object.fromEntries([['pts', num(t.Points)], ...COUNTS.map(([n, s]) => [n, num(t[s])])]); }

  // play-by-play
  const pbp = analyze(playbyplay, codes, boxLines);
  const fgaOk = codes.every(c => Math.abs(pbp.teams[c].fga - (tot[c].a2 + tot[c].a3)) <= 2);
  const countOk = codes.every(c => pbp.teams[c].poss > 40) && Math.abs(pbp.teams[codes[0]].poss - pbp.teams[codes[1]].poss) <= 6;
  const possOk = pbp.events > 0 && fgaOk && countOk;
  const onOk = possOk && pbp.onOk;

  // shots feed
  const rows = shots.Rows;
  const shotsOk = codes.every(c => {
    const a = rows.filter(r => trim(r.TEAM) === c), is = (r, k) => trim(r.ID_ACTION) === k;
    return ['2', '3'].every(k => a.filter(r => is(r, k + 'FGA') || is(r, k + 'FGM')).length === tot[c]['a' + k] && a.filter(r => is(r, k + 'FGM')).length === tot[c]['m' + k])
      && a.reduce((n, r) => n + num(r.POINTS), 0) === tot[c].pts;
  });
  const tagged = (c, flag) => rows.filter(r => trim(r.TEAM) === c && trim(r[flag]) === '1').reduce((n, r) => n + num(r.POINTS), 0);

  const teams = codes.map(team => {
    const poss = possOk ? pbp.teams[team].poss : Math.round(oliver(tot[team], tot[opp[team]]) * 10) / 10;
    return {
      ...ctx(team, { team_name: names[team], ot_periods: ot, sec: 2400 + 300 * ot }),
      ...Object.fromEntries(['q1', 'q2', 'q3', 'q4', 'ot1', 'ot2', 'ot3', 'ot4', 'ot5'].map(q => ['pts_' + q, quarters[team][q] ?? null])),
      ...tot[team], poss_pbp: pbp.teams[team].poss, poss_ok: possOk ? 1 : 0, poss, poss_src: possOk ? 'pbp' : 'oliver',
      sa: pbp.teams[team].sa, pbp_events: pbp.events,
      pts_fastbreak: tagged(team, 'FASTBREAK'), pts_second_chance: tagged(team, 'SECOND_CHANCE'), pts_off_turnover: tagged(team, 'POINTS_OFF_TURNOVER'),
      shots_ok: shotsOk ? 1 : 0,
    };
  });

  const players = codes.flatMap(team => lines[team].map(l => {
    const t = pbp.players[l.id], on = onOk && l.played && t;
    return {
      ...ctx(team, { player_id: l.id, player: l.name, dorsal: l.dorsal, starter: l.starter, played: l.played, sec: l.sec }),
      ...Object.fromEntries(COUNTS.map(([n, s]) => [n, num(l.p[s])])),
      plus_minus: num(l.p.Plusminus), pir_official: num(l.p.Valuation),
      sa: l.played ? (t?.sa ?? 0) : 0, on_ok: on ? 1 : 0, on_sec: l.played ? Math.round(t?.sec ?? 0) : 0,
      ...Object.fromEntries(ON.map(n => [n, on ? t[n] : null])),
    };
  }));

  const shotRows = rows.map(r => ({
    season, game: code, team: trim(r.TEAM), player_id: trim(r.ID_PLAYER), action: trim(r.ID_ACTION), made: trim(r.ID_ACTION).endsWith('M') ? 1 : 0,
    points: num(r.POINTS), x: Number(r.COORD_X), y: Number(r.COORD_Y), zone_feed: trim(r.ZONE), fastbreak: trim(r.FASTBREAK) === '1' ? 1 : 0,
    second_chance: trim(r.SECOND_CHANCE) === '1' ? 1 : 0, points_off_turnover: trim(r.POINTS_OFF_TURNOVER) === '1' ? 1 : 0,
    minute: num(r.MINUTE), clock: trim(r.CONSOLE), num: num(r.NUM_ANOT),
  }));

  return { players, teams, shots: shotRows, checks: { game: code, possOk, fgaOk, countOk, onOk: pbp.onOk, shotsOk, onBad: pbp.onBad, events: pbp.events, ot, pbpPoss: Object.fromEntries(codes.map(c => [c, pbp.teams[c].poss])), pbpReb: Object.fromEntries(codes.map(c => [c, [pbp.teams[c].oreb, pbp.teams[c].dreb]])), boxReb: Object.fromEntries(codes.map(c => [c, [tot[c].oreb, tot[c].dreb]])) } };
}

/* ---------- CSV ---------- */
const cell = v => v == null ? '' : typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v);
export const toCsv = (columns, rows) => [columns.map(c => c.name).join(','), ...rows.map(r => columns.map(c => cell(r[c.name])).join(','))].join('\n') + '\n';
