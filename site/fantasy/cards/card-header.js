/* The header (logo, title, next-game and back buttons, optional cr box and value chip) and the controls row (sample window, games played, Profile / Shooting) of a card.
   Parts, order and which show come from config/arrangement.json (fantasy.player-card.header, .header-title, .controls); this file only says how to draw each part. */
import { esc } from '../../core/html.js';
import * as Windows from '../../core/windows.js';
import { Data } from '../../core/data.js';
import { teamCode } from '../../core/teams.js';
import { drawParts } from '../../core/arrangement.js';
import { icon } from '../../core/icons.js';
import { sparklineSvg, sparklinePlaceholder } from '../../core/sparkline.js';
import { teamEntry } from '../../core/teams.js';
import { teamTitleLines } from '../../core/team-city.js';
import CITIES from '../../config/team-cities.json' with { type: 'json' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = iso => { const d = new Date(iso); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
/** "vs FBT ↗" (home) or "@ FBT ↗" (away): opens the opponent's team card. Empty when the team has no upcoming game. */
function nextBtn(next, roster) {
  if (!next) return '';
  const label = (next.home ? 'vs ' : '@ ') + esc(teamCode(roster, next.opp)), tip = 'Open ' + (roster.teams[next.opp] || next.oppName || next.opp) + ' card · ' + dayLabel(next.date);
  return `<button class="fw-next" data-next="${esc(next.opp)}" title="${esc(tip)}" aria-label="${esc(tip)}">${label}<span class="fw-arrow"> ↗</span></button>`;
}

const backBtn = cs => `<button class="fw-next fw-back" data-back title="Back to ${esc(cs.back.name)}">← ${esc(cs.back.name)}</button>`;
/** The upper-right actions of the header, in the configured order. Close is the dialog's own single button: card.js puts it into the empty slot drawn here. */
function actionsHtml({ cs, next, roster }, show) {
  const parts = drawParts('fantasy.player-card.header-actions', {
    'next-game-button': () => nextBtn(next, roster),
    'back-button': () => backBtn(cs),
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
/** Team cards keep the header they had: logo, title, then the actions (Back when opened from a player, Close) as plain items of the header row. */
function teamHeaderHtml({ cs, title, logo, show }) {
  const actions = drawParts('fantasy.player-card.header-actions-team', {
    'back-button': () => backBtn(cs),
    'close-button': () => '<span data-close-slot></span>',
  }, show).map(p => p.html).join('');
  const parts = drawParts('fantasy.player-card.header-team', {
    'logo': () => (logo ? `<img src="${esc(logo)}" alt="" data-part="${PART}header-logo">` : ''),
    'title': () => `<div>${title}</div>`,
    'header-actions-team': () => `<div data-part="${PART}header-actions-team">${actions}</div>`,
  }, show);
  return `<header class="fw-identity" data-part="${PART}header-team">${parts.map(p => p.html).join('')}</header>`;
}

/** ctx: { cs, players, name, team, row, roster, logo, next } */
export function headerHtml({ cs, players, name, team, row, roster, logo, next }) {
  const info = players ? Data.fantasyInfo(cs.id) : null;
  const entry = players ? roster.players?.[cs.id] : null, split = !!(entry?.first && entry?.last);   // given and family name only when both are known
  const lines = players ? null : teamTitleLines(name, CITIES.cities[teamEntry(roster, cs.id)?.id]);   // team cards: club name, and the approved city below it
  const show = { players, teams: !players, 'team-from-player': !players && !!cs.back, 'when-data': info !== null, 'logo-fallback': !players || !entry?.portrait };   // the team logo is the fallback for a player without a portrait
  const title = drawParts('fantasy.player-card.header-title', {
    'header-given-name': () => (split ? `<span data-part="${PART}header-given-name">${esc(entry.first)}</span>` : ''),
    'name': () => `<h2${lines?.city ? ` title="${esc(name)}"` : ''}>${esc(split ? entry.last : lines ? lines.club : name)}</h2>`,
    'header-city': () => (lines?.city ? `<p data-part="${PART}header-city">${esc(lines.city)}</p>` : ''),
    'team-line': () => { const line = players ? [row?.pos, roster.teams[team] || team].filter(Boolean).join(' | ') : ''; return line ? `<p>${esc(line)}</p>` : ''; },   // "Position | Team"; either alone; nothing when neither
  }, show).map(p => p.html).join('');
  if (!players) return teamHeaderHtml({ cs, title, logo, show });
  const identity = drawParts('fantasy.player-card.header-identity', {
    'logo': () => (logo ? `<img src="${esc(logo)}" alt="" data-part="${PART}header-logo">` : ''),
    'header-portrait': () => portraitHtml(entry, team, show),
    'title': () => `<div>${title}</div>`,
    'cr-box': () => (info?.cr == null ? `<span class="fw-cr-box" data-part="${PART}cr-box" data-placeholder>—</span>` : `<span class="fw-cr-box" data-part="${PART}cr-box">${esc(info.cr)}</span>`),   // the frame is always there; "—" without a value
    'value-chip': () => (info?.value == null ? `<span class="fw-value-chip" data-part="${PART}value-chip" data-placeholder>—</span>` : `<span class="fw-value-chip" data-part="${PART}value-chip">${esc(info.value)}</span>`),
    'value-sparkline': () => (info?.value == null ? sparklinePlaceholder(`${PART}value-sparkline-placeholder`) : sparklineSvg(info.valueSeries, `${PART}value-sparkline`)),   // no value: the space stays, with a flat muted line
  }, show).map(p => p.html).join('');
  const parts = drawParts('fantasy.player-card.header', {
    'header-identity': () => `<div data-part="${PART}header-identity">${identity}</div>`,
    'header-actions': () => actionsHtml({ cs, next, roster }, show),
  }, show);
  return `<header class="fw-identity" data-part="${PART}header">${parts.map(p => p.html).join('')}</header>`;
}

/** Icons the controls row draws (core/icons.js loadIcons, before the card is drawn). */
export const CONTROL_ICONS = ['profile', 'target'];
const VIEWS = [['profile', 'profile', 'Profile'], ['shooting', 'target', 'Shooting']];

/** The GP readout with the thin rule before it, as one group. Only for a known count (0 included). */
const gamesPlayedHtml = (gp, show) => `<div data-part="${PART}controls-games-played-group">${drawParts(PART + 'controls-games-played-group', {
  'controls-games-played-divider': () => `<span data-part="${PART}controls-games-played-divider" aria-hidden="true"></span>`,
  'controls-games-played': () => `<b data-part="${PART}controls-games-played">${gp} GP</b>`,
}, show).map(p => p.html).join('')}</div>`;

/** gp: games played in the selected period, or null / undefined when it is not available (then no readout). Team cards show none. */
export function controlsHtml({ cs, players, gp }) {
  const viewButton = ([view, iconName, label]) => `<button data-part="${PART}view-button" data-card-view="${view}" aria-pressed="${cs.mode === view}">${drawParts(PART + 'view-button', {
    'view-icon': () => `<span data-part="${PART}view-icon" aria-hidden="true">${icon(iconName)}</span>`,
    label: () => `<span>${label}</span>`,
  }, {}).map(p => p.html).join('')}</button>`;
  const parts = drawParts('fantasy.player-card.controls', {
    'window-buttons': () => `<div role="group" aria-label="Sample window" data-part="${PART}window-buttons">${Windows.buttons(cs, 'data-card-window')}</div>`,
    'games-played': () => (Number.isFinite(gp) ? gamesPlayedHtml(gp, { players }) : ''),   // divider + readout as one group, so they wrap together
    'view-button': () => `<div role="group" aria-label="Card view" data-part="${PART}view-buttons">${VIEWS.map(viewButton).join('')}</div>`,
  }, { players });
  return `<div class="fw-card-controls">${parts.map(p => p.html).join('')}</div>`;
}
