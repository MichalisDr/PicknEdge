// Display names for players: "LAST, FIRST" in capitals -> "First Last". Ported from the old site; corrections live in data/manual/name-fixes.json.
const SUFFIX = /^(I|II|III|IV|V)$/i;
const cap = w => String(w || '').toLowerCase().split(/([-'’ .])/)
  .map(p => /^[-'’ .]$/.test(p) || !p ? p : SUFFIX.test(p) ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)).join('')
  .replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase()).replace(/\s+,/g, ',');

export function displayName(raw, fixes = {}) {
  const [last, first] = String(raw || '').split(/\s*,\s*/);
  const name = first ? `${cap(first)} ${cap(last)}` : cap(last);
  return name.replace(/[A-Za-z]+/g, w => fixes[w] || w);
}
