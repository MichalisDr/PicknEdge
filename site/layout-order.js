/* Stacked (narrow-screen) order of a card layout, derived from site/layout.json only.
   stackOrder: the boxes in the layout's optional "stack" order (list of box ids), otherwise sorted by (y, x). dividers: ids of boxes that get a 1px rule above them in the stacked list, because a
   line of the layout runs along their top edge (horizontal) or their left edge (vertical). Pure functions. */
(function (g) {
  const byXY = L => L.boxes.map((b, i) => ({ b, i })).sort((p, q) => p.b.y - q.b.y || p.b.x - q.b.x || p.i - q.i).map(o => o.b);
  const stackOrder = L => Array.isArray(L.stack) ? L.stack.map(id => L.boxes.find(b => b.id === id)) : byXY(L);
  function dividers(L) {
    const out = new Set(), list = stackOrder(L);
    list.slice(1).forEach(b => {
      const hit = L.lines.some(l => l.o === 'h' ? l.y === b.y && l.x < b.x + b.w && l.x + l.n > b.x : l.x === b.x && l.y < b.y + b.h && l.y + l.n > b.y);
      if (hit) out.add(b.id);
    });
    return out;
  }
  g.PicknEdgeLayout = { stackOrder, dividers };
  if (typeof module !== 'undefined' && module.exports) module.exports = { stackOrder, dividers };
})(typeof globalThis !== 'undefined' ? globalThis : this);
