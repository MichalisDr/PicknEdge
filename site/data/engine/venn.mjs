// Three-set Venn of players by percentile cut-offs (e.g. "Efficient Scorers": USG% top 30%, TOV% bottom 30%, TS% top 30%).
// items: [{id, values: [v0, v1, v2]}]; sets: [{dir: 'high' | 'low', pct}]. Items with a missing value are left out (counted in `unavailable`).
export function venn(items, sets) {
  const ok = items.filter(x => x.values.length === 3 && x.values.every(Number.isFinite));
  const cuts = sets.map((s, k) => {
    const v = ok.map(x => x.values[k]).sort((a, b) => s.dir === 'low' ? a - b : b - a), n = v.length;
    return n ? v[Math.min(n - 1, Math.max(0, Math.ceil(n * s.pct / 100) - 1))] : null;
  });
  const regions = {};
  for (let m = 0; m < 8; m++) regions[m.toString(2).padStart(3, '0')] = { n: 0, ids: [] };
  const counts = [0, 0, 0];
  for (const x of ok) {
    const key = sets.map((s, k) => { const yes = s.dir === 'low' ? x.values[k] <= cuts[k] : x.values[k] >= cuts[k]; if (yes) counts[k]++; return yes ? 1 : 0; }).join('');
    regions[key].n++; regions[key].ids.push(x.id);
  }
  return { cuts, counts, regions, n: ok.length, unavailable: items.length - ok.length };
}
