/* Stacked (narrow-screen) order of a card layout, derived from site/layout.json only.
   stackOrder: the boxes in the layout's optional "stack" order (list of box ids), otherwise sorted by (y, x). Pure function. */
(function (g) {
  const byXY = L => L.boxes.map((b, i) => ({ b, i })).sort((p, q) => p.b.y - q.b.y || p.b.x - q.b.x || p.i - q.i).map(o => o.b);
  const stackOrder = L => Array.isArray(L.stack) ? L.stack.map(id => L.boxes.find(b => b.id === id)) : byXY(L);
  g.PicknEdgeLayout = { stackOrder };
  if (typeof module !== 'undefined' && module.exports) module.exports = { stackOrder };
})(typeof globalThis !== 'undefined' ? globalThis : this);
