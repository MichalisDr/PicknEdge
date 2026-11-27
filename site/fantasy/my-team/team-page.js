/* The My Team page (#fantasy/my-team): a personal virtual team builder, kept in this browser only. The page shows the gallery of team slots
   (gallery-view.js) under the Players / Teams title (same parts, same wrapper). Credits and portraits come from the Season view and the roster. */
import { Data } from '../../core/data.js';
import { esc } from '../../core/html.js';
import { load } from './team-store.js';
import { galleryHtml } from './gallery-view.js';

const status = text => `<p class="fw-empty" role="status">${esc(text)}</p>`;

export const pageHtml = (body = '') => `<section class="fantasy-stats fw-workbench mt-page"><div data-part="fantasy.stat-table.title-row"><h1 data-part="fantasy.stat-table.heading-title">My Team</h1></div>${body}</section>`;

export async function mount(target) {
  target.innerHTML = pageHtml(status('Loading data…'));
  const section = target.firstElementChild;
  let body;
  try {
    const [roster] = await Promise.all([Data.roster(), Data.view('players', 'season')]);
    body = galleryHtml(load(), { playerOf: id => roster.players[id] ?? null, crOf: id => Data.fantasyInfo(id, 'season')?.cr ?? null });
  } catch (e) {
    body = status('Could not load the data: ' + e.message);
  }
  if (section.isConnected) target.innerHTML = pageHtml(body);   // another page may have been opened while the data was loading
}
