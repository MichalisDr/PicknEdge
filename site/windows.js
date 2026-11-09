/* Sample windows shared by the Fantasy and Betting tables: Season, Last 10 / 5 / 3 (built views) and a custom window
   (last N games, home or away) summed in the browser by the tested engine. `s` is the page's state: { win, custom: { last, venue } }. */
(function (g) {
  'use strict';
  const D = g.PicknEdgeData;
  const LIST = [['season', 'Season', {}], ['l10', 'Last 10', { last: 10 }], ['l5', 'Last 5', { last: 5 }], ['l3', 'Last 3', { last: 3 }]];
  const cache = new Map();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const spec = s => s.win === 'custom' ? { last: s.custom.last || Infinity, venue: s.custom.venue } : LIST.find(w => w[0] === s.win)[2];
  /** View of a named window (default: the page's). Custom views are cached by their spec. */
  function view(kind, s, win = s.win) {
    if (win !== 'custom') return D.view(kind, win);
    const key = kind + JSON.stringify(spec(s));
    if (!cache.has(key)) cache.set(key, D.customView(kind, spec(s)));
    return cache.get(key);
  }
  const label = s => s.win !== 'custom' ? LIST.find(w => w[0] === s.win)[1]
    : `Custom · last ${s.custom.last || 'all'} ${s.custom.venue === 'home' ? 'home ' : s.custom.venue === 'away' ? 'away ' : ''}games`;
  const buttons = (s, attr = 'data-window') => [...LIST.map(w => [w[0], w[1]]), ['custom', 'Custom']]
    .map(([k, l]) => `<button ${attr}="${k}" aria-pressed="${s.win === k}">${l}</button>`).join('');
  const customForm = (s, cls = 'fw-filters fw-custom') => s.win === 'custom' || s.customOpen ? `<div class="${cls}" role="group" aria-label="Custom window">
    <label>Last <input data-custom="last" type="number" min="1" max="60" value="${s.custom.last || ''}" placeholder="all"> games</label>
    <label>Venue <select data-custom="venue">${[['all', 'All games'], ['home', 'Home only'], ['away', 'Away only']].map(([v, l]) => `<option value="${v}" ${s.custom.venue === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button type="button" class="fw-filter-btn" data-apply>Apply</button></div>` : '';
  /** Wire the window buttons and the custom form inside `root`; `redraw` is called after any change. */
  function wire(root, s, redraw, attr = 'data-window') {
    root.querySelectorAll(`[${attr}]`).forEach(b => { b.onclick = () => { s.win = b.getAttribute(attr); s.customOpen = s.win === 'custom'; redraw(); }; });
    const apply = root.querySelector('[data-apply]');
    if (apply) apply.onclick = () => {
      const last = root.querySelector('[data-custom=last]').value;
      s.custom = { last: last ? Math.max(1, Math.min(60, Number(last) | 0)) : 0, venue: root.querySelector('[data-custom=venue]').value };
      s.win = 'custom'; redraw();
    };
  }
  g.PicknEdgeWindows = { LIST, spec, view, label, buttons, customForm, wire, esc };
})(globalThis);
