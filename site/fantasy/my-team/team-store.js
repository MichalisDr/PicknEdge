/* My Team storage: the teams are kept in this browser only (localStorage), one key, JSON with a version. Storage that is blocked, full or corrupt
   never throws: reading falls back to the default teams, and a failed save says so. */
import { cleanTeams, defaultTeams } from '../../core/team-model.js';

export const KEY = 'picknedge.my-team.v1';
export const VERSION = 1;

/** The saved teams, or the default ones. `storage` is for the tests; the page uses localStorage. */
export function load(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY));
    return saved?.version === VERSION ? cleanTeams(saved.teams) : defaultTeams();
  } catch {
    return defaultTeams();
  }
}

/** Save the teams; false when the browser does not allow it. */
export function save(teams, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(KEY, JSON.stringify({ version: VERSION, teams: cleanTeams(teams) }));
    return true;
  } catch {
    return false;
  }
}

/** Back to the default teams, saved. */
export function reset(storage) {
  const teams = defaultTeams();
  save(teams, storage);
  return teams;
}
