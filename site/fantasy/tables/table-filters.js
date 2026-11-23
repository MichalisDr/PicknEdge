/* The Filters drawer of the Players table: pure helpers (the Credits range and handles, which rows pass) and the drawer markup. No data loading here.
   Every size, colour and weight is a CSS variable from config/sizes.json and theme/theme.json (fantasy.stat-table.filters-*); the markup carries classes only. */
import { esc } from '../../core/html.js';
import { teamLabel } from '../../core/teams.js';

/** One step of the Credits bar; the two handles are never closer than this. */
export const CR_STEP = 0.1;
const EPS = 1e-6;
const round = v => Math.round(Math.round(v / CR_STEP) * CR_STEP * 10) / 10;   // on the step, without float noise
const num = v => typeof v === 'number' && Number.isFinite(v);

/** The Credits range found in the data: the lowest and highest cr, on the step. No credits at all: 0 to 0 (the controls still draw). */
export function crRange(values) {
  const l = values.filter(num);
  return l.length ? { min: round(Math.floor(Math.min(...l) / CR_STEP + EPS) * CR_STEP), max: round(Math.ceil(Math.max(...l) / CR_STEP - EPS) * CR_STEP) } : { min: 0, max: 0 };
}
/** Move one handle of { lo, hi } to v: on the step, inside the range and at least one step from the other handle (the other handle never moves). */
export function move(range, cur, which, v) {
  const x = round(Number.isFinite(v) ? v : (which === 'lo' ? range.min : range.max));
  if (which === 'lo') return { lo: round(Math.max(range.min, Math.min(x, cur.hi - CR_STEP))), hi: cur.hi };
  return { lo: cur.lo, hi: round(Math.min(range.max, Math.max(x, cur.lo + CR_STEP))) };
}
/** The two handles of the state ({ lo, hi }); a null field is the end of the range. */
export function handles(s, range) {
  const lo = Math.min(Math.max(num(s.minCr) ? round(s.minCr) : range.min, range.min), Math.max(range.min, range.max - CR_STEP));
  return move(range, { lo, hi: num(s.maxCr) ? Math.min(round(s.maxCr), range.max) : range.max }, 'hi', num(s.maxCr) ? s.maxCr : range.max);
}
/** Move one handle of the state (the bar's handle or the Max. credits box), keep the minimum gap, store it (the end of the range = no filter = null). Returns { lo, hi }. */
export function moveState(s, range, which, v) {
  const h = move(range, handles(s, range), which, v);
  s.minCr = h.lo > range.min + EPS ? h.lo : null;
  s.maxCr = h.hi < range.max - EPS ? h.hi : null;
  return h;
}
/** Does a row pass the drawer filters (Team, Credits, Min. value, Min. games, Min. minutes)? r = { team, cr, value, gp, min }. The below-thresholds switch is not here: it decides who is listed, see table-data.js. */
export function passes(s, range, r) {
  if (s.team.length && !s.team.includes(r.team)) return false;
  const { lo, hi } = handles(s, range);
  if ((lo > range.min + EPS || hi < range.max - EPS) && !(num(r.cr) && r.cr >= lo - EPS && r.cr <= hi + EPS)) return false;
  if (s.minValue > 0 && !(num(r.value) && r.value >= s.minValue)) return false;
  return r.gp >= s.minGp && (r.min ?? 0) >= s.minMin;
}

/* Inline icons (currentColor, sized by the CSS around them). */
const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${body}</svg>`;
export const ICONS = {
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  tick: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>'),
};

const P = 'fw-fd';
const numberBox = (key, label, value, extra = '') => `<label class="${P}-field"><span class="${P}-label">${label}</span><input data-filter="${key}" data-fkey="${key}" type="number" inputmode="decimal" ${extra} value="${value}"></label>`;

/** The drawer. range = the Credits range of the data; roster = the roster (every team gets a checkbox). */
export function drawerHtml(state, { range, roster }) {
  const { lo, hi } = handles(state, range), span = range.max - range.min || 1;
  const left = ((lo - range.min) / span) * 100, right = ((range.max - hi) / span) * 100;
  const teams = Object.keys(roster.teams).map(c => [c, teamLabel(roster, c)]).sort((a, b) => a[1].localeCompare(b[1]));
  const rangeInput = (which, v) => `<input class="${P}-range" data-cr="${which}" data-fkey="cr-${which}" type="range" min="${range.min}" max="${range.max}" step="${CR_STEP}" value="${v}" ${which === 'lo' && lo > range.min + span / 2 ? 'data-top' : ''} aria-label="${which === 'lo' ? 'Minimum' : 'Maximum'} credits">`;
  return `<aside class="${P}" role="dialog" aria-label="Filters">
    <div class="${P}-head"><h2 class="${P}-title">Filters</h2><button type="button" class="${P}-close" data-filters-close data-fkey="close" aria-label="Close filters">${ICONS.close}</button></div>
    <div class="${P}-body">
      <section class="${P}-sec"><div class="${P}-label">Team <span class="${P}-note">none ticked = all teams</span></div>
        <div class="${P}-teamact"><button type="button" class="${P}-link" data-team-all>Select all</button><button type="button" class="${P}-link" data-team-none>Deselect all</button></div>
        <div class="${P}-teams">${teams.map(([c, n]) => `<label class="${P}-team"><input type="checkbox" data-team="${esc(c)}" data-fkey="team-${esc(c)}" ${state.team.includes(c) ? 'checked' : ''}><span class="${P}-box">${ICONS.tick}</span><span class="${P}-teamname">${esc(n)}</span></label>`).join('')}</div></section>
      <section class="${P}-sec"><div class="${P}-label">Credits</div>
        <div class="${P}-credits"><span class="${P}-num" data-cr-out="lo">${lo.toFixed(1)}</span>
          <div class="${P}-bar"><div class="${P}-rail"><span class="${P}-line"></span><span class="${P}-seg" data-cr-seg style="margin-left:${left}%;margin-right:${right}%"></span></div>${rangeInput('lo', lo)}${rangeInput('hi', hi)}</div>
          <span class="${P}-num" data-cr-out="hi">${hi.toFixed(1)}</span></div></section>
      <section class="${P}-fields">${numberBox('maxCr', 'Max. credits', hi.toFixed(1), `min="${range.min}" max="${range.max}" step="${CR_STEP}"`)}${numberBox('minValue', 'Min. value', state.minValue, 'min="0" step="0.1"')}${numberBox('minGp', 'Min. games', state.minGp, 'min="0" step="1"')}${numberBox('minMin', 'Min. minutes', state.minMin, 'min="0" step="1"')}</section>
      <section class="${P}-switchrow"><span class="${P}-switchtext" id="${P}-switch-label">Include players below the minimum thresholds</span>
        <label class="${P}-switch" data-on="${state.showAll}"><input type="checkbox" role="switch" data-filter="showAll" data-fkey="showAll" aria-labelledby="${P}-switch-label" ${state.showAll ? 'checked' : ''}><span class="${P}-track"></span><span class="${P}-knob">${state.showAll ? 'ON' : 'OFF'}</span></label></section>
    </div>
    <div class="${P}-foot"><button type="button" class="${P}-link ${P}-reset" data-filters-reset data-fkey="reset">${ICONS.reset}<span>Reset filters</span></button></div>
  </aside>`;
}
