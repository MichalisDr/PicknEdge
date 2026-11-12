/* Arrangement of a component from config/arrangement.json: which parts, in which order, which are shown. The view code only says how to draw each part. */
import ARRANGEMENT from '../config/arrangement.json' with { type: 'json' };

/** The entry of a component part, by its name: screen.component.part. */
export function arrangementOf(name, config = ARRANGEMENT) {
  const [screen, component, part] = name.split('.');
  const entry = config.component[screen]?.[component]?.[part];
  if (!entry) throw new Error('no arrangement named ' + name);
  return entry;
}

/**
 * Draw the parts of a component in the configured order.
 * draw: { partName: () => html } (a part may return '' when it has nothing to show); show: { condition: boolean } for the `show` words of the config.
 * Returns [{ name, align, html }] for the parts that are shown and not empty.
 */
export function drawParts(name, draw, show, config = ARRANGEMENT) {
  const out = [];
  for (const p of arrangementOf(name, config).parts) {
    if (!(p.name in draw)) throw new Error(`${name}: no way to draw the part "${p.name}"`);
    if (p.show !== 'always' && !show[p.show]) continue;
    const html = draw[p.name]();
    if (html) out.push({ name: p.name, align: p.align || 'start', html });
  }
  return out;
}
