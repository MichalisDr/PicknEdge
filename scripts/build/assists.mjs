// Assist attribution: which made field goals were assisted. Pure function, ported from the old site (fantasy-shots.js).
//
// The shots feed's NUM_ANOT equals the play-by-play NUMBEROFPLAY, so a made shot is identified exactly. The ORDER in which the
// feed delivers plays (quarter by quarter) is what matters: the numbers of corrected plays are out of order and the clock of an
// AS play is not reliable, so plays are never sorted.
// An AS belongs to:
//   (1) the play right before it, when that is a made FG of the same team by another player not yet assisted;
//   (2) otherwise a free-throw trip: the play right before it is a made FT of the same team by another player, or
//   (3) a FT/FTA of the same team by another player with the same clock within 12 plays in the same quarter.
// A free-throw-trip assist counts for the team but never marks a field goal. Anything else is unresolved.
// A team's game is valid only if every AS of the team is resolved and the number of AS equals its box-score assists; the whole game is
// unknown if a made FG of the shots feed is not the same made FG (number, team, player) in the play-by-play, with unique numbers.
// An unknown team-game is never treated as "unassisted".

const QUARTERS = ['FirstQuarter', 'SecondQuarter', 'ThirdQuarter', 'ForthQuarter', 'ExtraTime'];
const trim = v => String(v ?? '').trim();
const isMake = t => /^[23]FGM$/.test(t);

/**
 * @param pbp          raw PlayByPlay response
 * @param shotRows     raw Points feed rows
 * @param boxAssists   {teamCode: assists in the box score}
 * @returns {set: Set of NUM_ANOT of assisted made FGs, ok: Set of team codes with a fully linked game} or null
 */
export function linkAssists(pbp, shotRows, boxAssists) {
  const plays = QUARTERS.flatMap((q, qi) => (pbp?.[q] || []).map(e => ({
    n: Number(e.NUMBEROFPLAY), q: qi, team: trim(e.CODETEAM), player: trim(e.PLAYER_ID), type: trim(e.PLAYTYPE), mt: trim(e.MARKERTIME),
  })));
  if (!plays.length) return null;
  const set = new Set(), count = {}, bad = new Set(), makes = new Map();
  for (const e of plays.filter(e => isMake(e.type))) { if (makes.has(e.n)) return null; makes.set(e.n, e); }
  plays.forEach((e, i) => {
    if (e.type !== 'AS') return;
    count[e.team] = (count[e.team] || 0) + 1;
    const prev = plays[i - 1], other = m => m && m.team === e.team && m.player !== e.player;
    if (other(prev) && isMake(prev.type) && !set.has(prev.n)) set.add(prev.n);
    else if (other(prev) && prev.type === 'FTM') { /* free-throw assist */ }
    else if (plays.some((m, j) => other(m) && /^FT[AM]$/.test(m.type) && m.q === e.q && m.mt === e.mt && Math.abs(j - i) <= 12)) { /* free-throw assist */ }
    else bad.add(e.team);
  });
  for (const r of shotRows || []) {
    if (!isMake(trim(r.ID_ACTION))) continue;
    const m = makes.get(Number(r.NUM_ANOT));
    if (!m || m.team !== trim(r.TEAM) || m.player !== trim(r.ID_PLAYER)) return null;
  }
  const ok = new Set(Object.keys(boxAssists).filter(team => !bad.has(team) && (count[team] || 0) === boxAssists[team]));
  return { set, ok };
}
