/* The court and the bench of the team card, markup only: a half court with the basket at the top and the starter slots in rows by position (centres, forwards,
   guards, from the formation). A filled slot is the court card: portrait on the team-colour fade, name strip, then the next opponent, CR and Value,
   and the Season PIR and MIN. The same card and empty slot are for the bench too. Every element has a data-part equal to its theme / sizes key;
   the court lines are the shot chart's (no zones), the fade is the player card header's, the badge and the CR / Value figures are the Players name cell's. */
import { esc } from '../../core/html.js';
import { teamColour } from '../../core/team-colour.js';
import { BENCH, COACH, SIXTH_MAN, slotRows } from '../../core/team-model.js';
import { ShotZones } from '../shotchart/shot-zones.js';
import { figuresHtml } from '../tables/table-name-cell.js';

const part = key => `data-part="fantasy.my-team.${key}"`;
export const POSITION_NAMES = { G: 'Guard', F: 'Forward', C: 'Center' };

/** The round portrait of a player (gallery and picker); player: { name, portrait } or null. A filled circle without an image when there is no portrait. */
export const portraitHtml = player => `<span ${part('slot-portrait')} data-filled title="${esc(player?.name ?? '')}">${player?.portrait ? `<img src="${esc(player.portrait)}" alt="">` : ''}</span>`;

export const emptyPortraitHtml = () => `<span ${part('slot-portrait')}></span>`;

/** An empty slot: a circle with a plus and its label. */
export function emptySlotHtml(label, attrs) {
  return `<button type="button" ${part('empty-slot')} ${attrs} aria-label="Add a ${esc(label.toLowerCase())}"><span ${part('empty-circle')} aria-hidden="true">+</span><span ${part('empty-label')}>${esc(label.toUpperCase())}</span></button>`;
}

/**
 * A filled slot. player: { name, fullName, portrait, pos, teamCode, next: { home, code } | null, info: Data.fantasyInfo | null, pir, min } (pir and min
 * are formatted Season averages). A figure without data draws nothing; its line keeps its height, so every card is the same size.
 * Two buttons lie over the card, never one inside the other: one covers it and opens the player card, a small one empties the slot.
 */
export function courtCardHtml(player, attrs) {
  const next = player.next ? `${player.next.home ? 'vs' : '@'} ${player.next.code}` : '';
  const stat = (label, value) => `<span ${part('card-stat')}><span ${part('card-stat-label')}>${label}</span>${esc(value)}</span>`;
  return `<div ${part('court-card')} ${attrs}>
    <span ${part('card-frame')}><span data-part="fantasy.player-card.header-portrait-fade" style="${teamColour(player.teamCode)}"></span>${player.portrait ? `<img src="${esc(player.portrait)}" alt="">` : ''}</span>
    <span ${part('card-strip')}>${['G', 'F', 'C'].includes(player.pos) ? `<span data-part="fantasy.stat-table.name-cell-position-badge" title="Position">${player.pos}</span>` : ''}<span ${part('card-name')} title="${esc(player.fullName)}">${esc(player.name)}</span></span>
    <span ${part('card-panel')}>
      <span ${part('card-next-row')}><span ${part('card-next')}>${esc(next)}</span><span ${part('card-figures')}>${figuresHtml(player.info && { ...player.info, valueSeries: null })}</span></span>
      <span ${part('card-stats')}>${stat('PIR', player.pir)}${stat('MIN', player.min)}</span>
    </span>
    <button type="button" ${part('card-open')} data-open-player title="${esc(player.fullName)}" aria-label="Open the player card of ${esc(player.fullName)}"></button>
    <button type="button" ${part('card-remove')} data-remove title="Remove from the team" aria-label="Remove ${esc(player.fullName)} from the team"><span aria-hidden="true">×</span></button>
  </div>`;
}

const [bx, by, bw, bh] = ShotZones.COURT_BOX;
const linesHtml = () => `<span ${part('court-lines')} aria-hidden="true"><svg viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="xMidYMin meet" focusable="false">${ShotZones.courtLines()}</svg></span>`;

/** The court with the starters of a team. playerOf(id) -> the player of courtCardHtml. */
export function courtHtml(team, playerOf) {
  const rows = slotRows(team.formation).map(({ position, indexes }) => `<div ${part('court-row')} data-position-row="${position}">${indexes.map(i => {
    const id = team.starters[i], attrs = `data-slot="starters:${i}"`;
    return id ? courtCardHtml(playerOf(id), attrs) : emptySlotHtml(POSITION_NAMES[position], attrs);
  }).join('')}</div>`).join('');
  return `<div ${part('court')}>${linesHtml()}${rows}</div>`;
}

/** The label above a bench slot, by its index: the 6th man, four bench players, the coach. */
export const benchLabel = index => (index === SIXTH_MAN ? '6TH MAN' : index === COACH ? 'COACH' : 'BENCH');
const benchName = index => (index === SIXTH_MAN ? '6th man' : 'bench player');

/** An empty bench slot: a dashed box of the card's size with a plus. */
const benchEmptyHtml = (index, attrs) => `<button type="button" ${part('bench-empty')} ${attrs} aria-label="Add a ${benchName(index)}"><span aria-hidden="true">+</span></button>`;

/** The coach slot. There is no coach data yet, so it is only an empty state and not a button; a coach's portrait or team logo will be drawn here. */
const coachHtml = attrs => `<div ${part('bench-coach')} ${attrs}><span ${part('bench-note')}>No data yet</span></div>`;

/** The bench of a team: six equal slots, as wide as the court. A filled slot is the court card. */
export function benchHtml(team, playerOf) {
  const slots = Array.from({ length: BENCH }, (_, i) => {
    const id = team.bench[i], attrs = `data-slot="bench:${i}"`;
    const content = i === COACH ? coachHtml(attrs) : id ? courtCardHtml(playerOf(id), attrs) : benchEmptyHtml(i, attrs);
    return `<div ${part('bench-slot')}><span ${part('bench-label')}>${benchLabel(i)}</span>${content}</div>`;
  }).join('');
  return `<div ${part('bench')}><div ${part('bench-row')}>${slots}</div></div>`;
}
