/* Sample windows shared by the Fantasy and Betting tables: Season, Last 10 / 5 / 3 (each a built view of the team's most recent games).
   `s` is the page's state: { win }. Any other window will be designed later as a filter. */
(function (g) {
  'use strict';
  const D = g.PicknEdgeData;
  const LIST = [['season', 'Season', {}], ['l10', 'Last 10', { last: 10 }], ['l5', 'Last 5', { last: 5 }], ['l3', 'Last 3', { last: 3 }]];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const spec = s => LIST.find(w => w[0] === s.win)[2];                 // {last} of the window, {} for the season
  /** View of a named window (default: the page's). */
  const view = (kind, s, win = s.win) => D.view(kind, win);
  const label = s => LIST.find(w => w[0] === s.win)[1];
  const buttons = (s, attr = 'data-window') => LIST.map(w => `<button ${attr}="${w[0]}" aria-pressed="${s.win === w[0]}">${w[1]}</button>`).join('');
  /** Wire the window buttons inside `root`; `redraw` is called after any change. */
  function wire(root, s, redraw, attr = 'data-window') {
    root.querySelectorAll(`[${attr}]`).forEach(b => { b.onclick = () => { s.win = b.getAttribute(attr); redraw(); }; });
  }
  g.PicknEdgeWindows = { LIST, spec, view, label, buttons, wire, esc };
})(globalThis);
