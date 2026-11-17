/* Players table: sizes the first column from the rows shown and gives the CR and Value slots one width each, so every CR box and value chip sits at the same
   x in every row. Layout only (widths in px); nothing here changes a colour, a font or a value. Teams keep the width of config/table-layouts.json (firstCol).
   The pure part (fitWidths) takes measured numbers; fitFirstColumn measures the live table and applies the result. */

/** m: { pad, rows: [{ badge, identity, family, figures }], crW, valW, gap, min, avail }; every number in px.
    Returns { first, need, mustHave }: need = the width every row fits in whole; mustHave = the width that keeps every family name whole (given names may shrink below it). */
export function fitWidths({ pad, rows, crW, valW, gap, min, avail }) {
  const figsW = crW + valW + (crW && valW ? gap : 0);
  const part = (r, name) => r.badge + (r.badge ? gap : 0) + name + (r.figures && figsW ? gap + figsW : 0);
  const need = Math.max(0, ...rows.map(r => part(r, r.identity))) + pad;
  const mustHave = Math.max(0, ...rows.map(r => part(r, r.family))) + pad;
  const first = Math.ceil(Math.max(mustHave, Math.min(Math.max(min, need), Math.max(min, avail))));
  return { first: Math.max(min, first), need: Math.ceil(need), mustHave: Math.ceil(mustHave) };
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
  const widest = els => Math.max(0, ...els.map(e => Math.ceil(e.getBoundingClientRect().width)));
  const crW = widest(crs), valW = widest(chips);
  const gap = px(getComputedStyle(cells[0]).columnGap);
  const th = table.querySelector('tbody th'), cs = getComputedStyle(th), pad = px(cs.paddingLeft) + px(cs.paddingRight);
  const rows = cells.map(c => {
    const badge = q(c, 'name-cell-position-badge')[0], given = q(c, 'name-cell-given-name')[0], family = q(c, 'name-cell-family-name')[0], who = c.querySelector('.fw-who');
    const button = c.querySelector('.fw-name'), whoW = who ? who.scrollWidth : 0;
    const familyW = family ? family.scrollWidth : button.scrollWidth, givenW = given ? given.scrollWidth + px(getComputedStyle(given).marginRight) : 0;
    return { badge: badge ? Math.ceil(badge.getBoundingClientRect().width + px(getComputedStyle(badge).marginRight)) : 0, identity: Math.max(givenW + familyW, whoW), family: Math.max(familyW, whoW), figures: !!q(c, 'name-cell-figures').length };
  });
  const numCols = table.querySelectorAll('thead th').length - 1;
  const r = fitWidths({ pad, rows, crW, valW, gap, min, avail: wrap.clientWidth - numCols * numWidth });
  for (const e of crs) e.style.width = crW + 'px';
  for (const e of chips) { e.style.width = valW + 'px'; if (crW && e.previousElementSibling === null) e.style.marginLeft = crW + gap + 'px'; }
  table.querySelector('colgroup col').style.width = r.first + 'px';
  table.style.setProperty('--table-total', r.first + numCols * numWidth + 'px');
  return { ...r, crW, valW, numCols, total: r.first + numCols * numWidth, container: wrap.clientWidth };
}
