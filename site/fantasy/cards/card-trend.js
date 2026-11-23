/* The per-game chart of one metric on a card: title and value, the LAST 5 / LAST 10 averages, the bars chart, and (players) the sample's level, range and variation. */
import * as Windows from '../../core/windows.js';
import { esc } from '../../core/html.js';
import { fmt } from '../../core/format.js';
import { loadSeries } from '../../core/game-series.js';
import { barsChart } from './bars-chart.js';
import { Data } from '../../core/data.js';
import { teamCode } from '../../core/teams.js';

const lastBox = (series, n, m) => {
  const w = series.window(n);
  return `<div class="fw-ibox"><span>LAST ${n} AVG</span><strong>${fmt(w, m)}</strong></div>`;
};

/* ---------- cr and value (the header's two figures): the same bars chart, fed by the per-round series of Data.fantasyInfo ---------- */
/** The two header figures that open a trend: key = their data-metric. cr is no registry metric, so it carries its own chart definition. */
export const FANTASY_KEYS = ['cr', 'value'];
const CR_METRIC = { id: 'cr', label: 'Credits', direction: 0, chartScale: 'range', format: { digits: 1, suffix: '' } };   // a price: bars on the data range, no good / bad tone
const finiteSome = a => Array.isArray(a) && a.some(Number.isFinite);
/** Can the header figure `key` open a chart for this player and window? (it needs at least one round with a value) */
export const fantasyChartable = (info, key) => !!info && finiteSome(key === 'cr' ? info.crSeries : info.valueSeries);

/** Rolling 5 of a per-round series, drawn over the last 5 rounds only (null elsewhere and wherever one of its 5 values is missing). */
export function recentRolling5(values) {
  return values.map((_, k) => {
    if (k < 4 || k < values.length - 5) return null;
    const w = values.slice(k - 4, k + 1);
    return w.every(Number.isFinite) ? w.reduce((a, b) => a + b, 0) / 5 : null;
  });
}

/** Series in the shape of core/game-series.js for barsChart: one point per round (value null = no value that round). */
export function fantasySeries(values, rounds, key) {
  const points = values.map((v, i) => { const g = rounds.get(i + 1); return { game: g?.game ?? i + 1, round: i + 1, opponent: g?.opponent ?? '', home: !!g?.home, played: Number.isFinite(v), value: Number.isFinite(v) ? v : null }; });
  return { points, recentRolling: () => (key === 'cr' ? values.map(() => null) : recentRolling5(values)) };
}

export async function fantasyTrendBlock(cs, season, byId) {
  const key = cs.selected, info = Data.fantasyInfo(cs.id, cs.win), base = Data.fantasyInfo(cs.id, 'season');
  if (!fantasyChartable(info, key)) return '<p class="fw-empty">Not enough data for this metric.</p>';
  const [roster, games] = await Promise.all([Data.roster(), Data.games('teams')]), team = season.row(cs.id)?.team;
  const rounds = new Map(games.filter(r => r.team === team).map(r => [Number(r.round), { game: r.game, opponent: teamCode(roster, r.opp), home: r.home === 1 }]));
  const cr = key === 'cr', m = cr ? CR_METRIC : byId.value, series = fantasySeries(cr ? info.crSeries : info.valueSeries, rounds, key);
  const current = cr ? info.cr.toFixed(m.format.digits) : Data.formatMetric('value', info.value);
  const opts = cr ? {} : { windowLabel: Windows.label(cs), windowValue: info.value, seasonValue: base?.value ?? null, isSeason: cs.win === 'season', windowGames: Windows.spec(cs).last ?? Infinity };   // a price has nothing to average
  return `<section class="fw-trend"><div class="fw-section-title"><h3>${esc(m.label)}</h3><b>${esc(current)}</b></div>${barsChart(series, m, opts)}</section>`;
}

export async function trendBlock(cs, view, season, byId) {
  const m = byId[cs.selected], series = await loadSeries(cs.entity, cs.id, cs.selected), cur = view.get(cs.id, cs.selected), base = season.get(cs.id, cs.selected);
  let insight = '';
  if (cs.entity === 'players') {
    const last = Windows.spec(cs).last ?? Infinity, inWin = series.points.filter(p => Number.isFinite(p.value) && series.inWindow(last).includes(p.game)).map(p => p.value), n = inWin.length, mean = inWin.reduce((a, b) => a + b, 0) / (n || 1);
    const sd = n > 1 ? Math.sqrt(inWin.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)) : null, u = m.format.suffix, dg = m.format.digits;
    const box = (t, v, s) => `<div class="fw-ibox"><span>${t}</span><strong>${v}</strong><small>${s}${n < 3 ? ' · <em class="fw-small">small sample</em>' : ''}</small></div>`, ag = k => k + (k === 1 ? ' game' : ' games');
    insight = `<div class="fw-iboxes">${box('Season level', fmt(base, m), ag(season.get(cs.id, 'gp').value) + ' · Season')}${box('Range of appearances', n ? inWin.reduce((a, b) => Math.min(a, b)).toFixed(dg) + u + ' – ' + inWin.reduce((a, b) => Math.max(a, b)).toFixed(dg) + u : '—', ag(n) + ' · ' + Windows.label(cs))}${box('Variation', Number.isFinite(sd) ? 'σ ' + sd.toFixed(dg) + (m.kind === 'pct' ? ' pp' : '') : '—', 'standard deviation · ' + ag(n) + ' · ' + Windows.label(cs))}</div>`;
  }
  return `<section class="fw-trend"><div class="fw-section-title"><h3>${esc(m.label)}</h3><b>${fmt(cur, m)}</b></div><div class="fw-iboxes fw-last">${lastBox(series, 5, m)}${lastBox(series, 10, m)}</div>${barsChart(series, m, { windowLabel: Windows.label(cs), windowValue: cur.value, seasonValue: base.value, isSeason: cs.win === 'season', windowGames: Windows.spec(cs).last ?? Infinity })}${insight}</section>`;
}
