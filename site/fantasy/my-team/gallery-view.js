/* My Team gallery, markup only: one button per team with its name, formation, the five starter portraits, the credits bar and the filled-slot counts.
   Every element has a data-part equal to its theme / sizes key. */
import { esc } from '../../core/html.js';
import { COACH, credits } from '../../core/team-model.js';

const part = key => `data-part="fantasy.my-team.${key}"`;
const count = ids => ids.filter(Boolean).length;
const amount = n => n.toFixed(1);

function portraitHtml(id, playerOf) {
  if (!id) return `<span ${part('slot-portrait')}></span>`;
  const player = playerOf(id);
  return `<span ${part('slot-portrait')} data-filled title="${esc(player?.name ?? '')}">${player?.portrait ? `<img src="${esc(player.portrait)}" alt="">` : ''}</span>`;
}

/** lookups: { playerOf(id) -> { name, portrait } | null, crOf(id) -> number | null }. */
export function teamSlotHtml(team, index, { playerOf, crOf }) {
  const c = credits(team, crOf), starters = count(team.starters), bench = count(team.bench.slice(0, COACH));
  const spent = c.cap === null ? 0 : Math.min(100, (c.used / c.cap) * 100);
  const label = `${team.name}, formation ${team.formation}, ${amount(c.used)} of ${team.capText} credits used${c.isOver ? `, ${amount(c.over)} over the cap` : ''}, ${starters} of ${team.starters.length} starters, ${bench} of ${COACH} bench`;
  return `<button type="button" ${part('team-slot')} data-team-slot="${index}" aria-label="${esc(label)}">
    <span ${part('team-slot-header')}><span ${part('team-slot-name')}>${esc(team.name)}</span><span ${part('team-slot-formation')}>${esc(team.formation)}</span></span>
    <span ${part('portrait-row')}>${team.starters.map(id => portraitHtml(id, playerOf)).join('')}</span>
    <span ${part('credits-meter')} data-over="${c.isOver}"><span ${part('credits-text')}>${amount(c.used)} / ${esc(team.capText)}</span><span ${part('credits-bar')}><span ${part('credits-fill')} style="width:${spent}%"></span></span></span>
    <span ${part('team-slot-count')}>${starters}/${team.starters.length} starters · ${bench}/${COACH} bench</span>
  </button>`;
}

export const galleryHtml = (teams, lookups) => `<div ${part('gallery')}>${teams.map((team, i) => teamSlotHtml(team, i, lookups)).join('')}</div>`;
