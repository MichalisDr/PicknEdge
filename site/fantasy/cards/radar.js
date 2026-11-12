/* Radars of the cards: the player's Net Production Radar (with Net / Gross, per game / per 100 and a comparison player) and the team's Opponent Production Radar. */
import { esc } from '../../core/html.js';
import { fnum } from '../../core/format.js';

const TEAM_RADAR = [['2p', '2P'], ['3p', '3P'], ['ft', 'FT'], ['ast', 'AST'], ['dreb', 'DREB'], ['oreb', 'OREB'], ['blk', 'BLK'], ['stl', 'STL']];
const RADAR = [['ft', 'FT'], ['2p', '2P'], ['3p', '3P'], ['ast', 'AST−TOV'], ['dreb', 'DREB'], ['oreb', 'OREB'], ['stlblk', 'STL+BLK'], ['fd', 'FD−FC']];
const RSCALE = { game: { lo: -3, hi: 15, step: 3, suffix: '_g', label: 'Net PIR / game' }, per100: { lo: -10, hi: 50, step: 10, suffix: '_100', label: 'Net PIR / 100 poss' } };

/* Radar geometry shared by the player and team radars. axes = [[label, value, otherValue?]], frac maps a value to 0..1 of the radius. */
function radarSvg(axes, frac, rings, labelOf) {
  const n = axes.length, cx = 250, cy = 195, R = 135, pt = (i, f) => [cx + Math.sin(i * 2 * Math.PI / n) * R * f, cy - Math.cos(i * 2 * Math.PI / n) * R * f];
  const poly = f => axes.map((_, i) => pt(i, f).join(',')).join(' '), shape = (k, who) => `<polygon points="${axes.map((a, i) => pt(i, Number.isFinite(a[k]) ? frac(a[k]) : 0).join(',')).join(' ')}" fill="var(--fantasy-card-radar-${who}-fill)" stroke="var(--fantasy-card-radar-${who}-stroke)" stroke-width="2"/>`;
  const two = axes.some(a => a.length > 2);
  return `<svg viewBox="0 0 500 395" role="img" aria-label="Net contribution by category">${rings.map(v => `<polygon points="${poly(frac(v))}" fill="none" stroke="${v === 0 ? 'var(--fantasy-card-radar-ring-zero-stroke)' : 'var(--fantasy-card-radar-ring-stroke)'}"/><text x="257" y="${(cy - R * frac(v)).toFixed(0)}">${labelOf(v)}</text>`).join('')}${axes.map((_, i) => `<path d="M${cx} ${cy}L${pt(i, 1).join(' ')}" stroke="var(--fantasy-card-radar-axis-stroke)"/>`).join('')}${two ? shape(2, 'compare') : ''}${shape(1, 'own')}${axes.map((a, i) => { const [x, y] = pt(i, 1.23); return `<g><text x="${x}" y="${y - 4}" text-anchor="middle">${a[0]}</text><text x="${x}" y="${y + 13}" text-anchor="middle">${fnum(a[1])}</text>${two ? `<text x="${x}" y="${y + 26}" text-anchor="middle">${fnum(a[2])}</text>` : ''}</g>`; }).join('')}</svg>`;
}
export function radar(cs, view, byId, roster, cmpView) {
  const sc = RSCALE[cs.radar], frac = v => Math.min(1, Math.max(0, (v - sc.lo) / (sc.hi - sc.lo)));
  const axes = RADAR.map(([k, l]) => { const id = `${cs.net === 'gross' ? 'rg' : 'rd'}_${k}${sc.suffix}`, a = [l, view.get(cs.id, id).value]; if (cs.cmp && cmpView.row(cs.cmp)) a.push(cmpView.get(cs.cmp, id).value); return a; });
  const rings = []; for (let v = sc.lo; v <= sc.hi + 1e-9; v += sc.step) rings.push(v);
  const options = view.keys.filter(k => k !== cs.id && view.get(k, 'gp').value > 0).map(k => [k, roster.players[k]?.name || k]).sort((x, y) => x[1].localeCompare(y[1]));
  const cmpName = cs.cmp ? roster.players[cs.cmp]?.name || cs.cmp : '';
  return `<section class="fw-radar"><div class="fw-section-title"><h3>Net Production Radar</h3><span>${cs.net === 'gross' ? sc.label.replace('Net', 'Gross') : sc.label}</span></div>
    <div class="fw-switch" role="group" aria-label="Radar contribution">${[['net', 'Net'], ['gross', 'Gross']].map(([k, l]) => `<button data-net="${k}" aria-pressed="${cs.net === k}">${l}</button>`).join('')}</div> <div class="fw-switch" role="group" aria-label="Radar basis">${[['game', 'Per game'], ['per100', 'Per 100 poss']].map(([k, l]) => `<button data-radar="${k}" aria-pressed="${cs.radar === k}">${l}</button>`).join('')}</div>
    <label class="fw-cmp">Compare with <select data-cmp><option value="">—</option>${options.map(([k, n]) => `<option value="${esc(k)}" ${k === cs.cmp ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    ${cs.cmp ? `<div class="fw-leg"><span><i class="fw-k-r"></i>${esc(roster.players[cs.id]?.name || cs.id)}</span><span><i></i>${esc(cmpName)}</span></div>` : ''}
    ${radarSvg(axes, frac, rings, v => v)}
    <details class="fw-method"><summary>How the radar is calculated</summary><p>Net: each axis is a net contribution: shooting points minus misses (FT = made − missed, 2P = 2 × made − missed, 3P = 3 × made − missed), assists minus turnovers, steals plus blocks minus blocks against, fouls drawn minus fouls committed; rebounds as they are. Per 100: offensive categories use the team's offensive possessions on court, DREB the defensive ones, the two mixed categories the average of both. Scales are fixed (per game −3 to 15, per 100 −10 to 50); zero sits at one sixth of the radius and negative values stay in the labels. Gross shows only the positive contributions (made free throws, 2 × made twos, 3 × made threes, assists, rebounds, steals plus blocks, fouls drawn) on the same scales. Comparing two players uses the same scale and the same window for both.</p></details></section>`;
}
export function teamRadar(cs, view, season) {
  const axes = TEAM_RADAR.map(([k, l]) => [l, view.get(cs.id, `rt_${k}_100`).value]);
  const cohort = [view, season].flatMap(v => v.keys.flatMap(k => TEAM_RADAR.map(([x]) => v.get(k, `rt_${x}_100`).value))).filter(Number.isFinite);
  const limit = Math.ceil(Math.max(1, ...cohort) / 5) * 5, frac = v => Math.min(1, Math.max(0, v / limit));
  return `<section class="fw-radar"><div class="fw-section-title"><h3>Opponent Production Radar</h3><span>Net PIR / 100 opponent possessions</span></div>
    ${radarSvg(axes, frac, [.25, .5, .75, 1].map(f => limit * f), v => Math.round(v))}
    <details class="fw-method"><summary>How the radar is calculated</summary><p>What the opposing players produced against this team, per 100 opponent possessions: 2P = 2 × made − missed, 3P = 3 × made − missed, FT = made − missed, plus assists, defensive and offensive rebounds, blocks and steals. Rebounds count only the rebounds credited to players: the team totals also contain team rebounds (credited to nobody, for example off the buzzer or out of bounds), which are not production of any player. Negative contributions stay in the labels; the shape stops at zero. One scale for all axes and all teams (Season and the selected window).</p></details></section>`;}
