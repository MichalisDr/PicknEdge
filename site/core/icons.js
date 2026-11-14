/* Inline icons by name. An icon is an SVG file in assets/icons/ drawn with currentColor only (see the README there), so its colour is the `color` of the
   element around it, which comes from that element's theme key. Load the icons a screen needs once, then draw them anywhere:
     await loadIcons(['arrow-up-right']);   ...   `<button>${icon('arrow-up-right')}</button>`  */
const cache = new Map();
const BASE = new URL('../assets/icons/', import.meta.url);

/** Reject an icon that would not follow the colour of its surroundings. */
export function checkIcon(name, svg) {
  if (!/^\s*<svg[\s>]/.test(svg)) throw new Error(`icon ${name}: not an SVG`);
  if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(svg)) throw new Error(`icon ${name}: has a raw colour (use currentColor)`);
  for (const m of svg.matchAll(/\b(fill|stroke|color|stop-color)\s*[=:]\s*["']?([^"';\s>]+)/g))
    if (!['currentColor', 'none', 'inherit'].includes(m[2])) throw new Error(`icon ${name}: ${m[1]}="${m[2]}" (use currentColor)`);
  return svg;
}

/** Fetch the named icons once. `get` is injectable for tests: name -> SVG text. */
export async function loadIcons(names, get = async name => { const r = await fetch(new URL(name + '.svg', BASE)); if (!r.ok) throw new Error(`icon ${name}: not found`); return r.text(); }) {
  await Promise.all(names.filter(n => !cache.has(n)).map(async n => cache.set(n, checkIcon(n, await get(n)).trim())));
}

/** The inline <svg> of a loaded icon: sized to the text (1em), hidden from screen readers unless a label is given. */
export function icon(name, label = '') {
  const svg = cache.get(name);
  if (svg === undefined) throw new Error(`icon ${name} is not loaded: call loadIcons first`);
  const a = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return svg.replace(/^<svg/, `<svg class="fw-icon" width="1em" height="1em" focusable="false" ${a}`);
}
