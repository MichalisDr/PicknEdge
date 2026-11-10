// Play-by-play analysis for one game: team possessions, shot attempts (SA), and for every player the
// on-court components (verified lineups). Pure functions, no I/O. Ported from site/euroleague-data.js
// with two intended changes: multi-overtime handling and on-court rebound counts.
//
// Possession = an unbroken run of own-team events; a new possession starts at each change of team and at
// the start of every period. Technical free throws (same clock as the technical) do not change possession.
// SA = a shot, or one free-throw trip (and-one adds none, technical free throws add none).

const OWN = new Set(['2FGA', '2FGM', '3FGA', '3FGM', 'FTA', 'FTM', 'TO', 'O', 'D', 'ST', 'AS']);
const SHOTS = new Set(['2FGA', '2FGM', '3FGA', '3FGM']);
const TECH = new Set(['CMT1', 'CMT2', 'C', 'B']);
export const TOLERANCE_SEC = 75;   // per-player gap allowed between tracked seconds and box-score minutes

const clock = s => { const [m, x] = String(s || '').split(':').map(Number); return Number.isFinite(m) ? m * 60 + (x || 0) : 0; };
const trim = v => String(v ?? '').trim();

/** Period 0-3 = quarters, 4.. = overtimes. Returns [{events, start (s), len (s), firstMinute}] */
export function splitPeriods(pbp) {
  const quarters = [pbp.FirstQuarter, pbp.SecondQuarter, pbp.ThirdQuarter, pbp.ForthQuarter].map(q => [...q]);
  const ot = [];
  let cur = 0;                                           // all overtimes arrive in one array; split by MINUTE (41-45, 46-50, ...)
  for (const e of pbp.ExtraTime) {
    const type = trim(e.PLAYTYPE);
    // End-of-period / end-of-game markers carry the NEXT minute but belong to the period they close.
    if (type !== 'EP' && type !== 'EG') cur = Math.max(cur, Math.floor((Number(e.MINUTE) - 41) / 5));
    (ot[cur] ||= []).push(e);
  }
  const events = [...quarters, ...Array.from(ot, x => x || [])];
  const firstMinute = qi => (qi <= 4 ? qi * 10 + 1 : 40 + (qi - 4) * 5 + 1);
  // Some events of the end of a period are logged at the start of the next one (clock 00:00, MINUTE of the new
  // period's first minute): move them to the end of the previous period (game 75 of 2026-27).
  for (let qi = 1; qi < events.length; qi++) {
    const stray = e => trim(e.MARKERTIME) === '00:00' && Number(e.MINUTE) === firstMinute(qi);
    const moved = events[qi].filter(stray);
    if (moved.length) {
      events[qi] = events[qi].filter(e => !stray(e));
      events[qi - 1].push(...moved.sort((x, y) => x.NUMBEROFPLAY - y.NUMBEROFPLAY));
    }
  }
  let start = 0;
  return events.map(ev => { const len = start < 2400 ? 600 : 300, p = { events: ev, start, len }; start += len; return p; });
}

/**
 * @param pbp   raw PlayByPlay response
 * @param teams [codeA, codeB]
 * @param box   {code: [{id, starter, sec}]}  box-score lines per team (players with minutes > 0)
 */
export function analyze(pbp, [a, b], box) {
  const other = { [a]: b, [b]: a };
  const T = { [a]: { poss: 0, sa: 0, fga: 0, tov: 0, oreb: 0, dreb: 0 }, [b]: { poss: 0, sa: 0, fga: 0, tov: 0, oreb: 0, dreb: 0 } };
  const lineup = { [a]: new Set(), [b]: new Set() };
  const P = {};                                          // per player: own sa, tracked seconds, on-court counters
  const row = id => P[id] ||= { sa: 0, sec: 0, team_sa_on: 0, team_tov_on: 0, poss_off_on: 0, poss_def_on: 0, team_oreb_on: 0, team_dreb_on: 0, opp_oreb_on: 0, opp_dreb_on: 0, team_fgm_on: 0, opp_a2_on: 0 };
  for (const t of [a, b]) for (const p of box[t] || []) if (p.starter) lineup[t].add(p.id);
  const each = (t, fn) => { for (const id of lineup[t]) fn(row(id)); };

  let events = 0, sawSub = false, last = 0, qstart = 0, qlen = 600, any = false, lastFT = '', lastFGM = '';
  const advance = t => { const d = Math.max(0, t - last); if (d) for (const x of [a, b]) for (const id of lineup[x]) row(id).sec += d; last = t; };
  // An event whose clock contradicts its MINUTE (by more than one minute) is not trusted to move the clock.
  const trusted = (e, time) => { const m = Number(e.MINUTE); if (!Number.isFinite(m) || !m) return true; return Math.abs(m - (qstart / 60 + Math.max(1, Math.ceil(Math.max(0, qlen - clock(time)) / 60)))) <= 1; };

  for (const per of splitPeriods(pbp)) {
    let owner = null, techTime = null;
    const tech = { [a]: 0, [b]: 0 };
    qstart = per.start; qlen = per.len; last = qstart; any = false;
    for (const e of per.events) {
      const type = trim(e.PLAYTYPE), team = trim(e.CODETEAM), time = trim(e.MARKERTIME);
      // clock + substitutions
      any = true;
      let t = last;
      if (/^\d+:\d+$/.test(time) && trusted(e, time)) t = Math.min(qstart + qlen, Math.max(last, qstart + qlen - clock(time)));
      advance(t);
      const pid = trim(e.PLAYER_ID);
      if ((type === 'IN' || type === 'OUT') && team in lineup && pid) { sawSub = true; type === 'IN' ? lineup[team].add(pid) : lineup[team].delete(pid); }
      // possessions
      if (type === 'BP') { owner = null; tech[a] = tech[b] = 0; techTime = null; continue; }
      if (techTime !== null && time && time !== techTime) { tech[a] = tech[b] = 0; techTime = null; }
      if (!(team in T)) continue;
      if (TECH.has(type)) { tech[other[team]] += type === 'CMT2' ? 2 : 1; techTime = time; continue; }
      if (!OWN.has(type)) continue;
      events++;
      const key = `${team}|${pid}|${per.start}|${time}`;
      if (SHOTS.has(type)) {
        T[team].fga++; T[team].sa++; if (pid) row(pid).sa++; each(team, r => { r.team_sa_on++; });
        if (type.endsWith('M')) { lastFGM = key; each(team, r => { r.team_fgm_on++; }); }
        if (type[0] === '2') each(other[team], r => { r.opp_a2_on++; });   // opponent two-point attempts (for BLK%)
      }
      if (type === 'TO') { T[team].tov++; each(team, r => { r.team_tov_on++; }); }
      if (type === 'O' || type === 'D') {                // team rebounds included: they are rebounds available/taken
        const o = type === 'O';
        T[team][o ? 'oreb' : 'dreb']++;
        each(team, r => { r[o ? 'team_oreb_on' : 'team_dreb_on']++; });
        each(other[team], r => { r[o ? 'opp_oreb_on' : 'opp_dreb_on']++; });
      }
      if (type === 'FTA' || type === 'FTM') {
        const isTech = tech[team] > 0;
        if (!isTech && key !== lastFT && key !== lastFGM) { T[team].sa++; if (pid) row(pid).sa++; each(team, r => { r.team_sa_on++; }); }
        if (!isTech) lastFT = key;
        if (isTech) { tech[team]--; if (owner !== team) continue; }
      }
      if (team !== owner) { T[team].poss++; owner = team; each(team, r => { r.poss_off_on++; }); each(other[team], r => { r.poss_def_on++; }); }
    }
    if (any) advance(qstart + qlen);
  }

  // Lineup verification: tracked seconds must agree with box-score minutes for every player.
  const bad = [];
  for (const t of [a, b]) for (const p of box[t] || []) {
    const s = P[p.id]?.sec || 0;
    if (Math.abs(s - p.sec) > TOLERANCE_SEC) bad.push(`${p.id}:${Math.round(s)}/${p.sec}`);
  }
  return { teams: T, events, players: P, onOk: sawSub && !bad.length, onBad: sawSub ? bad : ['no-substitutions'] };
}

/** Oliver possession estimate, fallback when the play-by-play count fails its checks. */
export function oliver(s, o) {
  const fga = s.a2 + s.a3, fgm = s.m2 + s.m3, orb = s.oreb + o.dreb;
  return fga + 0.44 * s.a1 - 1.07 * (orb ? s.oreb / orb : 0) * (fga - fgm) + s.tov;
}
