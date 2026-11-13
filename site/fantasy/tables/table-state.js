/* The state of the Fantasy tables page: which table (entity + view), window, filters, sort. Kept for the session; the page redraws from it. */
export const state = { entity: 'teams', view: 'profile', win: 'season', position: 'ALL', query: '', minMin: 0, minGp: 1, team: '', filters: false, showAll: false, sort: '', dir: 'desc', sel: [], mode: 'table' };
