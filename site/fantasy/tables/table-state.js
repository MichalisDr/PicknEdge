/* The state of the Fantasy tables page: which table (entity + view), window, filters, sort. position = the selected positions (G / F / C, any combination; none or all three = every player). Kept for the session; the page redraws from it. */
/** The fields of the Filters drawer (Players) and their defaults; the only place the defaults are written. G / F / C, the search box, the window and Sort by value are not filters.
    team = the ticked team codes (empty = all teams); minCr / maxCr = the Credits handles (null = the end of the range found in the data); minValue 0 = no filter. */
export const FILTER_DEFAULTS = { team: [], minCr: null, maxCr: null, minValue: 0, minMin: 0, minGp: 1, showAll: false };
const same = (a, b) => (Array.isArray(a) ? Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]) : a === b);
/** True when any drawer field differs from its default. */
export const filtersActive = s => Object.entries(FILTER_DEFAULTS).some(([k, v]) => !same(s[k], v));
/** Reset filters: every drawer field back to its default; position, search, window and Sort by value stay as they are. */
export const resetFilters = s => Object.assign(s, FILTER_DEFAULTS, { team: [] });
export const state = { entity: 'teams', view: 'profile', win: 'season', position: [], query: '', ...FILTER_DEFAULTS, team: [], filters: false, sortValue: false, sort: '', dir: 'desc', sel: [], mode: 'table' };
