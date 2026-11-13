/* The header (logo, title, next-game and back buttons, optional cr box and value chip) and the controls row (sample window, games played, Shooting) of a card.
   Parts, order and which show come from config/arrangement.json (fantasy.player-card.header, .header-title, .controls); this file only says how to draw each part. */
import { esc } from '../../core/html.js';
import * as Windows from '../../core/windows.js';
import { Data } from '../../core/data.js';
import { teamCode } from '../../core/teams.js';
import { drawParts } from '../../core/arrangement.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = iso => { const d = new Date(iso); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
/** "vs FBT ↗" (home) or "@ FBT ↗" (away): opens the opponent's team card. Empty when the team has no upcoming game. */
function nextBtn(next, roster) {
  if (!next) return '';
  const label = (next.home ? 'vs ' : '@ ') + esc(teamCode(roster, next.opp)), tip = 'Open ' + (roster.teams[next.opp] || next.oppName || next.opp) + ' card · ' + dayLabel(next.date);
  return `<button class="fw-next" data-next="${esc(next.opp)}" title="${esc(tip)}" aria-label="${esc(tip)}">${label}<span class="fw-arrow"> ↗</span></button>`;
}

/** ctx: { cs, players, name, team, row, roster, logo, next } */
export function headerHtml({ cs, players, name, team, row, roster, logo, next }) {
  const info = players ? Data.fantasyInfo(cs.id) : null;
  const show = { players, 'team-from-player': !players && !!cs.back, 'when-data': info !== null };
  const title = drawParts('fantasy.player-card.header-title', {
    'kicker': () => `<small>${players ? 'PLAYER' : 'TEAM'} / FANTASY</small>`,
    'name': () => `<h2>${esc(name)}</h2>`,
    'team-line': () => `<p>${players ? esc(roster.teams[team] || team) + ' · ' + esc(row.pos || '—') : ''}</p>`,
  }, show).map(p => p.html).join('');
  const parts = drawParts('fantasy.player-card.header', {
    'logo': () => (logo ? `<img src="${esc(logo)}" alt="">` : ''),
    'title': () => `<div>${title}</div>`,
    'next-game-button': () => nextBtn(next, roster),
    'back-button': () => `<button class="fw-next fw-back" data-back title="Back to ${esc(cs.back.name)}">← ${esc(cs.back.name)}</button>`,
    'cr-box': () => info?.cr == null ? '' : `<span class="fw-cr-box">${esc(info.cr)}</span>`,
    'value-chip': () => info?.value == null ? '' : `<span class="fw-value-chip">${esc(info.value)}</span>`,
  }, show);
  return `<header class="fw-identity">${parts.map(p => p.html).join('')}</header>`;
}

export function controlsHtml({ cs, players, gp }) {
  const parts = drawParts('fantasy.player-card.controls', {
    'window-buttons': () => `<div class="fw-switch" role="group" aria-label="Sample window">${Windows.buttons(cs, 'data-card-window')}</div>`,
    'games-played': () => `<b>${gp || 0} GP</b>`,
    'view-button': () => `<div class="fw-switch" role="group" aria-label="Card view"><button data-card-view="shooting" aria-pressed="${cs.mode === 'shooting'}">Shooting</button></div>`,
  }, { players });
  return `<div class="fw-card-controls">${parts.map(p => p.html).join('')}</div>`;
}
