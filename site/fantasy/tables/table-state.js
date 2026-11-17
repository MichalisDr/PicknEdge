/* The state of the Fantasy tables page: which table (entity + view), window, filters, sort. position = the selected positions (G / F / C, any combination; none or all three = every player). Kept for the session; the page redraws from it. */
/** The fields of the Filters pop-up (Players) and their defaults; the only place the defaults are written. G / F / C, the search box and the window are not filters. */
export const FILTER_DEFAULTS = { team: '', minMin: 0, minGp: 1, showAll: false };
/** True when any pop-up field differs from its default. */
export const filtersActive = s => Object.entries(FILTER_DEFAULTS).some(([k, v]) => s[k] !== v);
/** Reset filters: every pop-up field back to its default; position, search and window stay as they are. */
export const resetFilters = s => Object.assign(s, FILTER_DEFAULTS);
export const state = { entity: 'teams', view: 'profile', win: 'season', position: [], query: '', ...FILTER_DEFAULTS, filters: false, sort: '', dir: 'desc', sel: [], mode: 'table' };
