/* Shot chart markup: the zone pop-up and the court with hexagons, shots and zone labels. Takes the prepared data of shot-data.js. */
import { esc } from '../../core/html.js';
import { ShotZones as SZ } from './shot-zones.js';

const pc = x => Number.isFinite(x) ? x.toFixed(1) + '%' : '—';
const signed = x => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(1);
const lvlName = (lv, team) => lv === null ? '' : SZ.levelName(lv, team);

export function zoneTip(z, mode, team, share) {
  if (mode === 'a' || mode === 'u') {
    const tot = z.as + z.un + z.uk, row = (k, l, n) => `<div class="sz-pop-row${mode === k ? ' sz-pop-sel' : ''}"><span>${l}</span><b>${n} / ${tot} · ${pc(z.uk > 0 || z.as + z.un === 0 ? null : share(n, z.as + z.un))}</b></div>`;
    return `<strong>${esc(z.name)}</strong>${row('a', 'Assisted', z.as)}${row('u', 'Unassisted', z.un)}${z.uk ? `<small>Percentage unavailable: ${z.uk} of ${tot} made shots have no confirmed assist record (assisted ${z.as}, unassisted ${z.un}).</small>` : ''}`;
  }
  const row = (l, v) => `<div class="sz-pop-row"><span>${l}</span><b>${v}</b></div>`;
  let d = '';
  if (z.change !== undefined && z.change !== null) d = `<div class="sz-pop-d">${z.change}</div>${team && z.change !== '—' ? '<small>A higher opponent FG% means a worse defence.</small>' : ''}`;
  return `<strong>${esc(z.name)}</strong>${row('Made / attempts', z.m + ' / ' + z.a + ' · ' + pc(z.fg))}${row('League FG%', pc(z.lg))}${row('Gap', (z.gap === null ? '—' : signed(z.gap) + ' pp') + (z.level !== null ? ' · ' + lvlName(z.level, team) : ''))}${row('Share of attempts', pc(z.share))}${team ? row('Defence rank', z.rank ? '#' + z.rank.rank : '—') : ''}${d}`;
}

export function chartHtml(m, st) {
  const team = m.ctx.kind === 'teams', { zones } = m;
  const unknown = zones.reduce((n, z) => n + z.uk, 0), who = team ? ' (opponent baskets)' : '';
  zones.forEach(z => { z.change = m.cmp ? (z.season === null || z.fg === null ? '—' : (Math.abs(z.fg - z.season) < 0.05 ? '0.0' : (z.fg - z.season > 0 ? '↑ ' : '↓ ') + signed(z.fg - z.season)) + ' percentage points vs Season') : null; });
  const gradeClass = z => SZ.levelClass(z.level);
  const split = (c, k) => c.uk > 0 || c.as + c.un === 0 ? null : m.eng.evaluate(m.eng.byId('share'), [{ n: k === 'a' ? c.as : c.un, of: c.as + c.un }]).value;
  const { cells } = SZ.bin(m.events.map(e => ({ x: e.x, y: e.y, zone: zones.findIndex(z => z.key === e.zone) })));
  const dominant = c => c.zones.reduce((b, n, i) => n > c.zones[b] ? i : b, 0);
  const hexPath = (cx, cy, r) => SZ.hexPts(cx, cy, r).map(([a, b]) => SZ.X(a) + ',' + SZ.Y(b)).join(' ');
  const hex = cells.map(c => `<polygon points="${hexPath(c.x, c.y, c.radius)}" class="${gradeClass(zones[dominant(c)])}" data-n="${c.n}"/>`).join('');
  const dot = SZ.DOT_R * SZ.SC, at = e => `cx="${SZ.X(e.x)}" cy="${SZ.Y(e.y)}" r="${dot}"`;
  const shots = m.events.map(e => `<circle class="${e.made ? 'sz-made' : 'sz-miss'}"${e.made && e.second_chance ? ' data-sc="1"' : ''} ${at(e)}/>`).join('');
  const hl = m.events.filter(e => e.made && e.assisted !== null).map(e => `<circle class="sz-hl" data-m="${e.assisted ? 'a' : 'u'}"${e.second_chance ? ' data-sc="1"' : ''} ${at(e)}/>`).join('');
  const labels = zones.map(z => {
    const [lx, ly] = SZ.LABELS[z.i], w = 32, cx = SZ.X(lx), cy = SZ.Y(ly);
    const rect = (k, h, c) => `<rect data-m="${k}"${c ? ` class="${c}"` : ''} x="${cx - w / 2}" y="${cy - 7}" width="${w}" height="${h}" rx="3"${k === 'fg' ? ` class="${z.a ? gradeClass(z) : 'g-empty'}"` : ''}/>`;
    const text = (k, s) => `<text data-m="${k}" x="${cx}" y="${cy + 3.2}" text-anchor="middle">${s}</text>`;
    return `<g class="sz-label" data-zone="${z.i}"><title>${esc(z.name)}: ${z.m}/${z.a}${z.level !== null ? ' · ' + lvlName(z.level, team) : ''}${z.rank ? ' · defence rank ' + z.rank.rank + '/' + z.rank.n : ''}</title>${rect('fg', z.rank ? 24 : 14)}${text('fg', z.a ? z.fg.toFixed(1) + '%' : '—')}${z.rank ? `<text data-m="fg" class="sz-zone-rank" x="${cx}" y="${cy + 12.5}" text-anchor="middle">#${z.rank.rank} / ${z.rank.n}</text>` : ''}${rect('a', 14, 'sz-au-r')}${text('a', pc(split(z, 'a')))}${rect('u', 14, 'sz-au-r')}${text('u', pc(split(z, 'u')))}</g>`;
  }).join('');
  const svg = (view, body) => `<svg class="pc-court sz-court" data-shotview="${view}" viewBox="0 0 ${SZ.VIEW.w} ${SZ.VIEW.h}" role="img" aria-label="${team ? 'Opponent' : 'Player'} shots, ${view === 'hex' ? 'hexagon volume' : 'individual shots'}"${st.view === view ? '' : ' hidden'}>${SZ.court()}${body}${labels}</svg>`;
  const mode = (k, l) => `<p class="sz-mode" data-m="${k}">${l}: share of all made shots of each zone and area${who}${unknown ? ` · "—" where the assist is not confirmed (${unknown} made shots)` : ''}.</p>`;
  return `<div class="pc-shooting" data-hl="${st.view === 'shots' ? st.hl || 'none' : 'none'}" data-sc="${st.view === 'shots' && st.sc ? 1 : 0}">
    <div class="sz-head"><div class="sz-switch" role="group" aria-label="Shot chart view">${[['hex', 'Hex'], ['shots', 'Shots']].map(([k, l]) => `<button type="button" data-shotview-btn="${k}" aria-pressed="${st.view === k}">${l}</button>`).join('')}</div>
    <div class="sz-switch sz-au" role="group" aria-label="Second Chance, Assisted / Unassisted${who}"${st.view === 'shots' ? '' : ' hidden'}><button type="button" data-sc-btn aria-pressed="${st.view === 'shots' && st.sc}">Second Chance</button><span class="sz-sep" aria-hidden="true"></span>${[['a', 'Assisted'], ['u', 'Unassisted']].map(([k, l]) => `<button type="button" data-hl-btn="${k}" aria-pressed="${st.hl === k}">${l}</button>`).join('')}</div></div>
    ${mode('a', 'Assisted')}${mode('u', 'Unassisted')}${svg('hex', `<g class="sz-hex">${hex}</g>`)}${svg('shots', `<g class="sz-shots">${shots}</g><g class="sz-hlg">${hl}</g>`)}
    <div class="sz-pop" role="status" hidden></div><p class="pc-note">${m.gp ?? 0} GP · ${m.total} FGA${team ? ' · Defence rank: #1 = lowest opponent FG%.' : ''}</p></div>`;
}