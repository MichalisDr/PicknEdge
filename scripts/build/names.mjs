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

/**
 * Given and family name of a player, for the player card's name parts. rawName is the API's own "SURNAME, GIVEN": with exactly one comma and both sides
 * non-empty, first is the part after the comma and last the part before it, in display form (same capitalising and name-fixes as displayName).
 * Never split on spaces. Null when the shape is different, or when first + " " + last would not equal the display name (the card then keeps the display name).
 */
export function nameParts(raw, fixes = {}) {
  const sides = String(raw || '').split(',');
  if (sides.length !== 2) return null;
  const [last, first] = sides.map(s => s.trim());
  if (!first || !last) return null;
  const parts = { first: displayName(first, fixes), last: displayName(last, fixes) };
  return `${parts.first} ${parts.last}` === displayName(raw, fixes) ? parts : null;
}
