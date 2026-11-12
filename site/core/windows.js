/* Sample windows shared by the Fantasy and Betting tables: Season, Last 10 / 5 / 3 (each a built view of the team's most recent games).
   `s` is the page's state: { win }. Any other window will be designed later as a filter. */
import { Data } from './data.js';

export const LIST = [['season', 'Season', {}], ['l10', 'Last 10', { last: 10 }], ['l5', 'Last 5', { last: 5 }], ['l3', 'Last 3', { last: 3 }]];

/** {last} of the window, {} for the season. */
export const spec = s => LIST.find(w => w[0] === s.win)[2];
/** View of a named window (default: the page's). */
export const view = (kind, s, win = s.win) => Data.view(kind, win);
export const label = s => LIST.find(w => w[0] === s.win)[1];
export const buttons = (s, attr = 'data-window') => LIST.map(w => `<button ${attr}="${w[0]}" aria-pressed="${s.win === w[0]}">${w[1]}</button>`).join('');
/** Wire the window buttons inside `root`; `redraw` is called after any change. */
export function wire(root, s, redraw, attr = 'data-window') {
  root.querySelectorAll(`[${attr}]`).forEach(b => { b.onclick = () => { s.win = b.getAttribute(attr); redraw(); }; });
}
