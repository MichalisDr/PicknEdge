/* My Team, the logic with no screen: the shape of a team, formations and court slots, credits, edits and undo. Pure functions: a team is never
   changed in place, and an edit that changes nothing (or is not allowed) returns the same object.
   A team is { name, capText, formation, starters: [5], bench: [6] }; a slot holds a player id or null. bench[0] is the 6th man, bench[5] the coach.
   A formation counts guards-forwards-centres from the bottom of the court upward; the starters are stored in that order. */
export const MAX_TEAMS = 2;
export const FORMATIONS = ['2-2-1', '2-1-2', '1-2-2', '1-3-1', '3-1-1'];
export const STARTERS = 5;
export const BENCH = 6;
export const SIXTH_MAN = 0;
export const COACH = 5;
export const UNDO_LIMIT = 20;
export const DEFAULT_CAP = '115.6';
const POSITIONS = ['G', 'F', 'C'];

export const emptyTeam = (name, formation = FORMATIONS[0], capText = DEFAULT_CAP) => ({ name, capText, formation, starters: Array(STARTERS).fill(null), bench: Array(BENCH).fill(null) });
export const defaultTeams = () => [emptyTeam('Team 1', '2-1-2', DEFAULT_CAP), emptyTeam('Team 2', '2-2-1', '100')];

/** The position of each starter index of a formation, e.g. '2-1-2' -> ['G', 'G', 'F', 'C', 'C']. */
export function positionsOf(formation) {
  if (!FORMATIONS.includes(formation)) throw new Error('unknown formation ' + formation);
  return formation.split('-').flatMap((n, i) => Array(Number(n)).fill(POSITIONS[i]));
}

/** The rows of the court from the top (by the basket) to the bottom: centres, forwards, guards; each with its starter indexes. */
export function slotRows(formation) {
  const positions = positionsOf(formation);
  return [...POSITIONS].reverse().map(position => ({ position, indexes: positions.flatMap((p, i) => (p === position ? [i] : [])) }));
}

/** Another formation: the players stay in their position, in order, up to the new number of slots; the others leave the starters. */
export function setFormation(team, formation) {
  if (formation === team.formation || !FORMATIONS.includes(formation)) return team;
  const before = positionsOf(team.formation);
  const queues = Object.fromEntries(POSITIONS.map(p => [p, team.starters.filter((id, i) => id && before[i] === p)]));
  return { ...team, formation, starters: positionsOf(formation).map(p => queues[p].shift() ?? null) };
}

/** Every id of the team (starters, bench and coach). */
export const idsOf = team => [...team.starters, ...team.bench].filter(Boolean);

const isId = v => typeof v === 'string' && v !== '';

/** Put a player in a slot (area: 'starters' | 'bench'), or empty it with null. A player is in a team at most once. */
export function setPlayer(team, area, index, id) {
  if (area !== 'starters' && area !== 'bench') return team;
  const slots = team[area];
  if (!Number.isInteger(index) || index < 0 || index >= slots.length || slots[index] === id) return team;
  if (id !== null && (!isId(id) || idsOf(team).includes(id))) return team;
  return { ...team, [area]: slots.map((v, i) => (i === index ? id : v)) };
}

/** Empty every slot (starters, bench and coach); the name, formation and cap stay. */
export const clearPlayers = team => (idsOf(team).length ? { ...team, starters: Array(STARTERS).fill(null), bench: Array(BENCH).fill(null) } : team);

/** A new name (trimmed). An empty name keeps the old one. */
export function setName(team, name) {
  const next = String(name ?? '').trim();
  return !next || next === team.name ? team : { ...team, name: next };
}

const decimal = text => String(text ?? '').trim().replace(',', '.');

/** The cap as a number, or null when the text is not a positive number. A decimal comma is accepted. */
export function parseCap(text) {
  const s = decimal(text), n = /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A new cap. A text that is not a positive number keeps the old one. */
export function setCap(team, text) {
  if (parseCap(text) === null) return team;
  const capText = decimal(text);
  return capText === team.capText ? team : { ...team, capText };
}

const round2 = n => Math.round(n * 100) / 100;

/**
 * The credits of a team. The cap is soft: going over is reported, never blocked. The coach is not counted.
 * crOf(id) -> number | null. A player without a number adds nothing and is counted in `missing`.
 * Returns { used, cap, left, over, isOver, missing }.
 */
export function credits(team, crOf) {
  const values = [...team.starters, ...team.bench.slice(0, COACH)].filter(Boolean).map(crOf);
  const known = values.filter(v => Number.isFinite(v));
  const used = round2(known.reduce((a, b) => a + b, 0)), cap = parseCap(team.capText);
  const diff = cap === null ? 0 : round2(cap - used);
  return { used, cap, left: cap === null ? null : Math.max(0, diff), over: Math.max(0, -diff), isOver: diff < 0, missing: values.length - known.length };
}

/* Undo: an entry is { team, history }, the history holding the teams before the last UNDO_LIMIT changes, oldest first. */
export const startHistory = team => ({ team, history: [] });
export const change = (entry, team) => (team === entry.team ? entry : { team, history: [...entry.history, entry.team].slice(-UNDO_LIMIT) });
export const undo = entry => (entry.history.length ? { team: entry.history.at(-1), history: entry.history.slice(0, -1) } : entry);

/** A valid team made of whatever was read: each field that is not valid takes the fallback's value; a bad or repeated id leaves its slot empty. */
export function cleanTeam(raw, fallback) {
  const r = raw && typeof raw === 'object' ? raw : {}, seen = new Set();
  const slots = (list, length) => Array.from({ length }, (_, i) => {
    const id = Array.isArray(list) ? list[i] : null;
    if (!isId(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
  return {
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : fallback.name,
    capText: typeof r.capText === 'string' && parseCap(r.capText) !== null ? decimal(r.capText) : fallback.capText,
    formation: FORMATIONS.includes(r.formation) ? r.formation : fallback.formation,
    starters: slots(r.starters, STARTERS),
    bench: slots(r.bench, BENCH),
  };
}

/** Always MAX_TEAMS valid teams: extra ones are dropped, missing ones come from the defaults. */
export const cleanTeams = raw => defaultTeams().map((fallback, i) => cleanTeam(Array.isArray(raw) ? raw[i] : null, fallback));
