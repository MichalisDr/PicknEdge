/* The games coverage line of the top bar, from the manifest's games and lastDate: "100 games · Latest 6 Nov 2026".
   Each field shows only when available; the separator only when both do; null when neither. The date is the calendar date as written in the data
   (no local-time conversion). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function coverageText(manifest) {
  const parts = [];
  const games = manifest?.games;
  if (typeof games === 'number' && Number.isInteger(games) && games >= 0) parts.push(`${games} ${games === 1 ? 'game' : 'games'}`);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(manifest?.lastDate ?? ''));
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) parts.push(`Latest ${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`);
  return parts.length ? parts.join(' · ') : null;
}
