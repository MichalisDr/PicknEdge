/* Per-game trend chart of one metric (points, rolling 5, season line, league band) as an SVG string, and the difference badge of a window against the Season. */
import { esc } from '../../core/html.js';

export const LEVELS = { good: '#DFFBE9', bad: '#F6E0E3' };

function niceTicks(lo, hi) {
  const raw = (hi - lo) / 3 || 1, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw - 1e-12) || 10 * mag, out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(8));
  return { ticks: out, dec: Math.min(4, (String(+step.toPrecision(6)).split('.')[1] || '').length) };
}
export function trendChart(points, m, { small = false, diff = null, ref = null, league = null } = {}) {
  const valid = points.filter(p => Number.isFinite(p.value));
  if (!valid.length) return '<p class="fw-empty">Not enough data for this metric.</p>';
  const W_ = small ? 300 : 700, H = small ? 130 : 250, shared = league && league.n >= 10 && Number.isFinite(league.p2) && league.p98 > league.p2;
  let lo, hi;
  if (shared) { const pad = (league.p98 - league.p2) * .06; lo = league.p2 - pad; hi = league.p98 + pad; } else { lo = Math.min(...valid.map(p => p.value)); hi = Math.max(...valid.map(p => p.value)); }
  const span = hi - lo || 1, clamp = v => Math.min(hi, Math.max(lo, v)), x = i => 36 + i * (W_ - 72) / Math.max(1, points.length - 1), y = v => H - 42 - (clamp(v) - lo) / span * (H - 72), dig = m.format.digits;
  const step = small ? Math.ceil(points.length / 6) : 1, last = points.length - 1;   // small chart (table hover): value only on the last point, round labels thinned so nothing overlaps
  const labelled = i => small ? i === last || (i % step === 0 && last - i >= step / 2 + 0.5) : points.length <= 12 || i === last;
  const lines = key => { const out = []; let line = []; points.forEach((p, i) => { if (Number.isFinite(p[key])) line.push(x(i) + ',' + y(p[key])); else { if (line.length > 1) out.push(line); line = []; } }); if (line.length > 1) out.push(line); return out; };
  const band = shared && Number.isFinite(league.p25) && Number.isFinite(league.p75), nt = niceTicks(lo, hi), hasRef = Number.isFinite(ref);
  const svg = `<svg viewBox="0 0 ${W_} ${H}" class="fw-curve" role="img" aria-label="${esc(m.label)} per game">${band ? `<rect class="fw-band" x="36" y="${y(league.p75).toFixed(1)}" width="${W_ - 72}" height="${Math.max(1, y(league.p25) - y(league.p75)).toFixed(1)}"/>` : ''}${nt.ticks.map(v => `<line class="fw-gl" x1="36" x2="${W_ - 36}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="32" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v.toFixed(nt.dec)}</text>`).join('')}<line x1="36" x2="${W_ - 36}" y1="${H - 42}" y2="${H - 42}" stroke="#3b4655"/>${hasRef ? `<line class="fw-ref" x1="36" x2="${W_ - 36}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}"/>` : ''}${diff ? `<text class="fw-diff" x="${W_ - 8}" y="13" text-anchor="end" fill="${diff.color}"><title>${esc(diff.title)}</title>${diff.text}</text>` : ''}${lines('value').map(p => `<polyline points="${p.join(' ')}" fill="none" stroke="#ef3d25" stroke-opacity=".55" stroke-width="1.5"/>`).join('')}${lines('roll').map(p => `<polyline points="${p.join(' ')}" fill="none" stroke="#f2c14e" stroke-width="2.4" stroke-linejoin="round"/>`).join('')}${points.map((p, i) => !Number.isFinite(p.value) ? '' : `<g><circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="${p.recent === false ? '#7a4a45' : '#ef3d25'}"><title>R${p.round} · ${p.home ? 'vs' : '@'} ${esc(p.opponent)}: ${p.value.toFixed(dig)}</title></circle>${labelled(i) ? `${small && i !== points.length - 1 ? '' : `<text x="${x(i)}" y="${y(p.value) - 10}" text-anchor="middle">${p.value.toFixed(dig)}</text>`}<text x="${x(i)}" y="${H - 18}" text-anchor="middle">R${p.round}</text>` : ''}</g>`).join('')}</svg>`;
  return svg + `<div class="fw-leg"><span><i class="fw-k-g"></i>Per game</span><span><i class="fw-k-r"></i>Rolling 5</span>${hasRef ? `<span><i class="fw-k-s"></i>Season ${ref.toFixed(dig)}${m.format.suffix}</span>` : ''}${band ? '<span><i class="fw-k-b"></i>League P25–P75</span>' : ''}</div>`;
}
export const diffOf = (cur, season, m) => {
  if (!Number.isFinite(cur) || !Number.isFinite(season)) return { text: '—', color: '#fff', title: 'Not enough data' };
  const d = cur - season, dig = m.format.digits, zero = Math.abs(d) < Math.pow(10, -dig) / 2, good = zero ? 0 : m.direction * d;
  return { text: zero ? '0' : (d < 0 ? '−' : '+') + Math.abs(d).toFixed(dig), color: good > 0 ? LEVELS.good : good < 0 ? LEVELS.bad : '#fff', title: (m.kind === 'pct' ? 'percentage points · ' : '') + 'sample minus Season' };
};
