/* Chart axes that are not a metric of the registry. A chart's x / y is normally a metric id (metrics.json); an id listed here is read from the view instead.
   cr = the player's current credits in the window (the Fantasy backend's figure, the same one the table shows: view.fx(id).cr = Data.fantasyInfo(id, window).cr). */
const AXES = {
  cr: { id: 'cr', label: 'Credits', format: { digits: 1, suffix: '' }, direction: 0, get: (view, id) => view.fx(id)?.cr },
};

/* The axis rule of every metric a chart draws, declared once, here: the grid step (never picked from the data; the data decides only the ends, scale.js) and the two real limits there are:
   credits cannot be priced below 4, and a FG% cannot exceed 100. A new axis metric must be added here. */
const RULES = {
  pace: { step: 1 }, drtg: { step: 5 },
  o_efg: { step: 2 }, o_exp_efg: { step: 2 }, o_tov100: { step: 2 }, t_dreb_pct: { step: 2 }, o_a3_rate: { step: 2 }, o_fg3_pct: { step: 2 },
  o_rim_rate: { step: 2 }, o_zs_rim_pct: { step: 5, ceiling: 100 },
  cr: { step: 1, floor: 4 }, pir: { step: 5 }, sa100: { step: 5 }, ts_pct: { step: 5 },
};

/** The axis rule of an id: { step, floor?, ceiling? }. */
export const axisRule = id => {
  if (!RULES[id]) throw new Error('no axis step declared for ' + id + ' (axes.js)');
  return RULES[id];
};

/** The axis description (label, format, direction) of an id: the extra axis, or the registry metric. */
export const axisMeta = (id, byId) => AXES[id] || byId[id];

/** The value of an axis for one entity in a view (undefined / non-finite = no value). */
export const axisValue = (view, id, key) => (AXES[key] ? AXES[key].get(view, id) : view.get(id, key)?.value);
