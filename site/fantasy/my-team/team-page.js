/* The My Team page (#fantasy/my-team): a personal virtual team builder, kept in this browser only. The page shows the gallery of team slots
   (gallery-view.js) under the Players / Teams title (same parts, same wrapper); a slot opens the team card (team-card.js). The page holds the state:
   one undo entry per team, saved after every change. Credits, portraits and the court cards come from the Season view, the roster and the schedule. */
import { Data } from '../../core/data.js';
import { esc } from '../../core/html.js';
import { loadIcons } from '../../core/icons.js';
import { teamCode } from '../../core/teams.js';
import { startHistory } from '../../core/team-model.js';
import { load, save } from './team-store.js';
import { galleryHtml } from './gallery-view.js';
import { shortName } from '../tables/table-name-cell.js';
import { open as openCard, CARD_ICONS } from './team-card.js';

const status = text => `<p class="fw-empty" role="status">${esc(text)}</p>`;

export const pageHtml = (body = '') => `<section class="fantasy-stats fw-workbench mt-page"><div data-part="fantasy.stat-table.title-row"><h1 data-part="fantasy.stat-table.heading-title">My Team</h1></div>${body}</section>`;

/** What a court card shows of a player: Season averages, credits and value (Data.fantasyInfo), the team's next game (Data.nextGame, the player card's source). */
export function courtPlayer(id, { roster, season, nextOf }) {
  const entry = roster.players[id], row = season.row(id), team = row?.team ?? entry?.team, next = nextOf.get(team);
  const fullName = entry?.name ?? row?.name ?? id, average = metric => Data.formatMetric(metric, season.get(id, metric)?.value ?? null);
  return {
    fullName, name: shortName(entry, fullName), portrait: entry?.portrait ?? null, pos: row?.pos ?? entry?.pos, teamCode: teamCode(roster, team),
    next: next ? { home: next.home, code: teamCode(roster, next.opp) } : null, info: Data.fantasyInfo(id, 'season'), pir: average('pir'), min: average('min'),
  };
}

/** The players the picker offers: those of the Season view (they have played) who are still on a roster, with the numbers the list is ordered by. */
export function pickerPool({ roster, season, nextOf }) {
  return season.keys.filter(id => roster.players[id]?.active).map(id => {
    const player = courtPlayer(id, { roster, season, nextOf });
    return { id, ...player, sort: { cr: player.info?.cr ?? null, pir: season.get(id, 'pir')?.value ?? null, min: season.get(id, 'min')?.value ?? null } };
  });
}

export async function mount(target) {
  target.innerHTML = pageHtml(status('Loading data…'));
  const loading = target.firstElementChild;
  let roster, season, nextOf;
  try {
    [roster, season] = await Promise.all([Data.roster(), Data.view('players', 'season'), Data.metrics(), loadIcons(CARD_ICONS)]);
    /* Without a schedule the cards simply show no next opponent. */
    nextOf = new Map(await Promise.all(Object.keys(roster.teams).map(async t => [t, await Data.nextGame(t).catch(() => null)])));
  } catch (e) {
    if (loading.isConnected) target.innerHTML = pageHtml(status('Could not load the data: ' + e.message));
    return;
  }
  if (!loading.isConnected) return;   // another page was opened while the data was loading

  const entries = load().map(startHistory);
  const lookups = { playerOf: id => roster.players[id] ?? null, crOf: id => Data.fantasyInfo(id, 'season')?.cr ?? null };
  const slot = i => target.querySelector(`[data-team-slot="${i}"]`);
  let players = null;   // built when the picker is first opened
  const draw = () => {
    target.innerHTML = pageHtml(galleryHtml(entries.map(e => e.team), lookups));
    entries.forEach((_, i) => {
      slot(i).onclick = () => openCard({
        get: () => entries[i],
        set: entry => { entries[i] = entry; save(entries.map(e => e.team)); draw(); },   // the gallery behind the card stays current
        crOf: lookups.crOf,
        playerOf: id => courtPlayer(id, { roster, season, nextOf }),
        pool: () => (players ??= pickerPool({ roster, season, nextOf })),
      }, () => slot(i)?.focus());   // the slot was redrawn: give the focus back to the new button
    });
  };
  draw();
}
