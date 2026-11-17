/* Players table: sizes the first column from the rows shown and gives the CR and Value slots one width each, so every CR box and value chip sits at the same
   x in every row. Layout only (widths in px); nothing here changes a colour, a font or a value. Teams keep the width of config/table-layouts.json (firstCol).
   The pure part (fitWidths) takes measured numbers; fitFirstColumn measures the live table and applies the result. Neither name line is ever clipped:
   the column grows with the widest of them (230 px is the minimum, not the maximum). */

/** m: { pad, rows: [{ badge, identity, figures }], crW, valW, gap, min }; every number in px (identity = the wider of the two lines). Returns { first, need }. */
export function fitWidths({ pad, rows, crW, valW, gap, min }) {
  const figsW = crW + valW + (crW && valW ? gap : 0);
  const need = Math.max(0, ...rows.map(r => r.badge + (r.badge ? gap : 0) + r.identity + (r.figures && figsW ? gap + figsW : 0))) + pad;
  return { first: Math.max(min, Math.ceil(need)), need: Math.ceil(need) };
}

const P = 'fantasy.stat-table.';
const q = (root, key) => [...root.querySelectorAll(`[data-part="${P}${key}"]`)];
const px = v => parseFloat(v) || 0;

/** Measures the drawn players table in `host`, applies slot widths and the first column width. Returns the numbers used, or null (no players table, or hidden). */
export function fitFirstColumn(host, { min, numWidth }) {
  const table = host.querySelector('table.fw-t'), wrap = host.querySelector('.fw-table-wrap');
  const cells = table ? q(table, 'players-name-cell') : [];
  if (!cells.length || !wrap || !wrap.clientWidth) return null;
  const crs = q(table, 'name-cell-cr-box'), chips = q(table, 'name-cell-value-chip');
  for (const e of [...crs, ...chips]) { e.style.width = ''; e.style.marginLeft = ''; }
  table.querySelector('colgroup col').style.width = '10000px';   // measure the lines unclipped
  const widest = els => Math.max(0, ...els.map(e => Math.ceil(e.getBoundingClientRect().width)));
  const crW = widest(crs), valW = widest(chips);
  const gap = px(getComputedStyle(cells[0]).columnGap);
  const th = table.querySelector('tbody th'), cs = getComputedStyle(th), pad = px(cs.paddingLeft) + px(cs.paddingRight);
  const rows = cells.map(c => {
    const badge = q(c, 'name-cell-position-badge')[0], button = c.querySelector('.fw-name'), who = c.querySelector('.fw-who');
    return { badge: badge ? Math.ceil(badge.getBoundingClientRect().width + px(getComputedStyle(badge).marginRight)) : 0, identity: Math.max(button.scrollWidth, who ? who.scrollWidth : 0), figures: !!q(c, 'name-cell-figures').length };
  });
  const numCols = table.querySelectorAll('thead th').length - 1;
  const r = fitWidths({ pad, rows, crW, valW, gap, min });
  for (const e of crs) e.style.width = crW + 'px';
  for (const e of chips) { e.style.width = valW + 'px'; if (crW && e.previousElementSibling === null) e.style.marginLeft = crW + gap + 'px'; }
  table.querySelector('colgroup col').style.width = r.first + 'px';
  table.style.setProperty('--table-total', r.first + numCols * numWidth + 'px');
  return { ...r, crW, valW, numCols, total: r.first + numCols * numWidth, container: wrap.clientWidth };
}
