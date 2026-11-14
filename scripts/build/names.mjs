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

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Given and family name from the roster's passportName / passportSurname, for the player card's name parts.
 * Used only when both exist and say the same letters (ignoring case, accents, spaces and punctuation) as the raw "LAST, FIRST" name, part by part;
 * otherwise null and the card keeps the display name. Nothing is split on spaces. name-fixes apply as for the display name.
 */
export function nameParts(raw, passportName, passportSurname, fixes = {}) {
  const [last, first] = String(raw || '').split(/\s*,\s*/);
  if (!first || !fold(passportName) || !fold(passportSurname)) return null;
  if (fold(first) !== fold(passportName) || fold(last) !== fold(passportSurname)) return null;
  return { first: displayName(passportName, fixes), last: displayName(passportSurname, fixes) };
}
