/* Chart axes that are not a metric of the registry. A chart's x / y is normally a metric id (metrics.json); an id listed here is read from the view instead.
   cr = the player's current credits in the window (the Fantasy backend's figure, the same one the table shows: view.fx(id).cr = Data.fantasyInfo(id, window).cr). */
const AXES = {
  cr: { id: 'cr', label: 'Credits', format: { digits: 1, suffix: '' }, direction: 0, get: (view, id) => view.fx(id)?.cr },
};

/** The axis description (label, format, direction) of an id: the extra axis, or the registry metric. */
export const axisMeta = (id, byId) => AXES[id] || byId[id];

/** The value of an axis for one entity in a view (undefined / non-finite = no value). */
export const axisValue = (view, id, key) => (AXES[key] ? AXES[key].get(view, id) : view.get(id, key)?.value);
