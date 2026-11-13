/* Team catalogue lookups (identity only: name, short label, Euroleague Fantasy code, logo). The catalogue itself is assets/teams.js. */
import { TEAMS } from '../assets/teams.js';

/** Catalogue entry of a team from the data (roster.logoIds maps the data code to the catalogue id), or undefined. */
export const teamEntry = (roster, dataCode) => TEAMS.find(t => t.id === roster?.logoIds?.[dataCode]);
/** Code of a team as the site shows it (the Euroleague Fantasy code); falls back to the data code. */
export const teamCode = (roster, dataCode) => (teamEntry(roster, dataCode) || {}).code || dataCode;
/** Short display name of a team; falls back to the roster's full name, then the code. */
export const teamLabel = (roster, code) => teamEntry(roster, code)?.label || roster.teams[code] || code;
/** Logo file of a team (path relative to index.html), or undefined. */
export const teamLogo = (roster, dataCode) => teamEntry(roster, dataCode)?.logo;
