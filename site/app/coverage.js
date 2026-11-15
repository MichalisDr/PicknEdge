/* The coverage element of the top bar (app.top-bar.coverage): one muted text, shown on the Fantasy area only (the "show" of the part in
   config/arrangement.json, app.top-bar.bar), hidden when there is no text. Betting keeps the header it had. */
import { drawParts } from '../core/arrangement.js';
import { coverageText } from '../core/coverage.js';

/** el: the coverage element; area: 'fantasy' | 'betting'; manifest: the data manifest (or null while it is not known). */
export function showCoverage(el, area, manifest) {
  const text = coverageText(manifest);
  const shown = drawParts('app.top-bar.bar', { coverage: () => text || '' }, { fantasy: area === 'fantasy' }).some(p => p.name === 'coverage');
  el.textContent = shown ? text : '';
  el.hidden = !shown;
}
