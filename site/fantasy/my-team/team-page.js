/* The My Team page (#fantasy/my-team): a personal virtual team builder, kept in this browser only. The page shows the gallery of team slots
   (gallery-view.js) under the Players / Teams title (same parts, same wrapper); a slot opens the team card (team-card.js). The page holds the state:
   one undo entry per team, saved after every change. Credits and portraits come from the Season view and the roster. */
import { Data } from '../../core/data.js';
import { esc } from '../../core/html.js';
import { loadIcons } from '../../core/icons.js';
import { startHistory } from '../../core/team-model.js';
import { load, save } from './team-store.js';
import { galleryHtml } from './gallery-view.js';
import { open as openCard, CARD_ICONS } from './team-card.js';

const status = text => `<p class="fw-empty" role="status">${esc(text)}</p>`;

export const pageHtml = (body = '') => `<section class="fantasy-stats fw-workbench mt-page"><div data-part="fantasy.stat-table.title-row"><h1 data-part="fantasy.stat-table.heading-title">My Team</h1></div>${body}</section>`;

export async function mount(target) {
  target.innerHTML = pageHtml(status('Loading data…'));
  const loading = target.firstElementChild;
  let roster;
  try {
    [roster] = await Promise.all([Data.roster(), Data.view('players', 'season'), loadIcons(CARD_ICONS)]);
  } catch (e) {
    if (loading.isConnected) target.innerHTML = pageHtml(status('Could not load the data: ' + e.message));
    return;
  }
  if (!loading.isConnected) return;   // another page was opened while the data was loading

  const entries = load().map(startHistory);
  const lookups = { playerOf: id => roster.players[id] ?? null, crOf: id => Data.fantasyInfo(id, 'season')?.cr ?? null };
  const slot = i => target.querySelector(`[data-team-slot="${i}"]`);
  const draw = () => {
    target.innerHTML = pageHtml(galleryHtml(entries.map(e => e.team), lookups));
    entries.forEach((_, i) => {
      slot(i).onclick = () => openCard({
        get: () => entries[i],
        set: entry => { entries[i] = entry; save(entries.map(e => e.team)); draw(); },   // the gallery behind the card stays current
        crOf: lookups.crOf,
      }, () => slot(i)?.focus());   // the slot was redrawn: give the focus back to the new button
    });
  };
  draw();
}
