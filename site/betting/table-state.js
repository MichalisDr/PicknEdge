/* The state of the Betting statistics page: teams or players, side, window, sort and filters. Kept for the session. */
export const state = { entity: 'teams', side: 'offense', win: 'season', col: 1, dir: -1, query: '',
  pl: { view: 'role', team: '', pos: '', min: 10, query: '', col: 'min', dir: -1 } };
