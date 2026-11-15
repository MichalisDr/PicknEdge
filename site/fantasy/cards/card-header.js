/* The header (logo, title, next-game and back buttons, optional cr box and value chip) and the controls row (sample window, games played, Profile / Shooting) of a card.
   Parts, order and which show come from config/arrangement.json (fantasy.player-card.header, .header-title, .controls); this file only says how to draw each part. */
import { esc } from '../../core/html.js';
import * as Windows from '../../core/windows.js';
import { Data } from '../../core/data.js';
import { teamCode } from '../../core/teams.js';
import { drawParts } from '../../core/arrangement.js';
import { icon } from '../../core/icons.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = iso => { const d = new Date(iso); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
/** "vs FBT ↗" (home) or "@ FBT ↗" (away): opens the opponent's team card. Empty when the team has no upcoming game. */
function nextBtn(next, roster) {
  if (!next) return '';
  const label = (next.home ? 'vs ' : '@ ') + esc(teamCode(roster, next.opp)), tip = 'Open ' + (roster.teams[next.opp] || next.oppName || next.opp) + ' card · ' + dayLabel(next.date);
  return `<button class="fw-next" data-next="${esc(next.opp)}" title="${esc(tip)}" aria-label="${esc(tip)}">${label}<span class="fw-arrow"> ↗</span></button>`;
}

/** The upper-right actions of the header, in the configured order. Close is the dialog's own single button: card.js puts it into the empty slot drawn here. */
function actionsHtml({ cs, next, roster }, show) {
  const parts = drawParts('fantasy.player-card.header-actions', {
    'next-game-button': () => nextBtn(next, roster),
    'back-button': () => `<button class="fw-next fw-back" data-back title="Back to ${esc(cs.back.name)}">← ${esc(cs.back.name)}</button>`,
    'close-button': () => '<span data-close-slot></span>',
  }, show);
  return `<div data-part="fantasy.player-card.header-actions">${parts.map(p => p.html).join('')}</div>`;
}

const PART = 'fantasy.player-card.';
/** The fade colour of a team's portrait: the theme key of that team (header-portrait-fade.team-colour-<team>, none filled yet), else the one neutral default key. */
const fadeColour = team => `--fade-colour:var(--fantasy-player-card-header-portrait-fade-team-colour-${String(team).replace(/[^\w-]/g, '')}, var(--fantasy-player-card-header-portrait-fade-default-colour))`;
/** Optional: the player's portrait (head and upper torso) with a fade behind it. Nothing when the roster entry has no `portrait`. */
function portraitHtml(entry, team, show) {
  if (!entry?.portrait) return '';
  const fade = drawParts(PART + 'header-portrait', { 'header-portrait-fade': () => `<span data-part="${PART}header-portrait-fade" style="${fadeColour(team)}"></span>` }, show).map(p => p.html).join('');
  return `<span data-part="${PART}header-portrait">${fade}<img src="${esc(entry.portrait)}" alt=""></span>`;
}
/** Optional: a small line of the last values as a line, coloured by the theme key of the element around it. Nothing without at least two numbers. */
function sparklineHtml(values) {
  if (!Array.isArray(values) || values.length < 2 || !values.every(Number.isFinite)) return '';
  const lo = Math.min(...values), span = Math.max(...values) - lo || 1;
  const points = values.map((v, i) => `${(100 * i / (values.length - 1)).toFixed(1)},${(30 - 30 * (v - lo) / span).toFixed(1)}`).join(' ');
  return `<svg data-part="${PART}value-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" vector-effect="non-scaling-stroke"/></svg>`;
}

/** ctx: { cs, players, name, team, row, roster, logo, next } */
export function headerHtml({ cs, players, name, team, row, roster, logo, next }) {
  const info = players ? Data.fantasyInfo(cs.id) : null;
  const entry = players ? roster.players?.[cs.id] : null, split = !!(entry?.first && entry?.last);   // given and family name only when both are known
  const show = { players, 'team-from-player': !players && !!cs.back, 'when-data': info !== null, 'logo-fallback': !players || !entry?.portrait };   // the team logo is the fallback for a player without a portrait
  const title = drawParts('fantasy.player-card.header-title', {
    'kicker': () => `<small>${players ? 'PLAYER' : 'TEAM'} / FANTASY</small>`,
    'header-given-name': () => (split ? `<span data-part="${PART}header-given-name">${esc(entry.first)}</span>` : ''),
    'name': () => `<h2>${esc(split ? entry.last : name)}</h2>`,
    'team-line': () => { const line = players ? [row?.pos, roster.teams[team] || team].filter(Boolean).join(' | ') : ''; return line ? `<p>${esc(line)}</p>` : ''; },   // "Position | Team"; either alone; nothing when neither
  }, show).map(p => p.html).join('');
  const identity = drawParts('fantasy.player-card.header-identity', {
    'logo': () => (logo ? `<img src="${esc(logo)}" alt="" data-part="${PART}header-logo">` : ''),
    'header-portrait': () => portraitHtml(entry, team, show),
    'title': () => `<div>${title}</div>`,
    'cr-box': () => info?.cr == null ? '' : `<span class="fw-cr-box" data-part="${PART}cr-box">${esc(info.cr)}</span>`,
    'value-chip': () => info?.value == null ? '' : `<span class="fw-value-chip" data-part="${PART}value-chip">${esc(info.value)}</span>`,
    'value-sparkline': () => sparklineHtml(info?.valueSeries),
  }, show).map(p => p.html).join('');
  const parts = drawParts('fantasy.player-card.header', {
    'header-identity': () => `<div data-part="${PART}header-identity">${identity}</div>`,
    'header-actions': () => actionsHtml({ cs, next, roster }, show),
  }, show);
  return `<header class="fw-identity">${parts.map(p => p.html).join('')}</header>`;
}

/** Icons the controls row draws (core/icons.js loadIcons, before the card is drawn). */
export const CONTROL_ICONS = ['profile', 'target'];
const VIEWS = [['profile', 'profile', 'Profile'], ['shooting', 'target', 'Shooting']];

/** gp: games played in the selected period, or null / undefined when it is not available (then no readout). Team cards show none. */
export function controlsHtml({ cs, players, gp }) {
  const viewButton = ([view, iconName, label]) => `<button data-part="${PART}view-button" data-card-view="${view}" aria-pressed="${cs.mode === view}">${drawParts(PART + 'view-button', {
    'view-icon': () => `<span data-part="${PART}view-icon" aria-hidden="true">${icon(iconName)}</span>`,
    label: () => `<span>${label}</span>`,
  }, {}).map(p => p.html).join('')}</button>`;
  const parts = drawParts('fantasy.player-card.controls', {
    'window-buttons': () => `<div role="group" aria-label="Sample window" data-part="${PART}window-buttons">${Windows.buttons(cs, 'data-card-window')}</div>`,
    'games-played': () => (Number.isFinite(gp) ? `<b data-part="${PART}controls-games-played">${gp} GP</b>` : ''),
    'view-button': () => `<div role="group" aria-label="Card view" data-part="${PART}view-buttons">${VIEWS.map(viewButton).join('')}</div>`,
  }, { players });
  return `<div class="fw-card-controls">${parts.map(p => p.html).join('')}</div>`;
}
