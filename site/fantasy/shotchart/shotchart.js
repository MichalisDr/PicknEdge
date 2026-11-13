/* Fantasy shot chart: mounts the court into a card and wires its interactions (hex / shots switch, assisted / unassisted and second-chance
   highlights, zone pop-ups). Data: shot-data.js, markup: shot-view.js, geometry and grading: shot-zones.js. */
import { esc } from '../../core/html.js';
import { ShotZones as SZ } from './shot-zones.js';
import { prepare } from './shot-data.js';
import { chartHtml, zoneTip } from './shot-view.js';

/** Render into `host` and wire its interactions; `st` is the card's persistent {view, hl, sc}. */
export async function mount(host, ctx, st) {
  host.innerHTML = '<p class="fw-empty" role="status">Loading shots…</p>';
  let m;
  try { m = await prepare(ctx); } catch (e) { host.innerHTML = `<p class="fw-empty">Could not load the shots: ${esc(e.message)}</p>`; return; }
  if (!m.total) { host.innerHTML = '<p class="fw-empty">No shots in this sample.</p>'; return; }
  host.innerHTML = chartHtml(m, st);
  const root = host.querySelector('.pc-shooting'), pop = root.querySelector('.sz-pop'), team = ctx.kind === 'teams';
  let pinned = null;
  const hide = () => { pop.hidden = true; };
  const share = (n, of) => of > 0 ? m.eng.evaluate(m.eng.byId('share'), [{ n, of }]).value : null;
  const zoneAt = (svg, e) => {
    const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * SZ.VIEW.w, sy = (e.clientY - r.top) / r.height * SZ.VIEW.h, x = (sx - SZ.X(0)) / SZ.SC, y = (sy - SZ.Y(0)) / SZ.SC;
    if (!(y >= SZ.BASELINE) || Math.abs(x) > 750 || sy > SZ.VIEW.h) return -1;
    return SZ.classify(x, y, y <= SZ.CORNER_Y ? Math.abs(x) > SZ.CORNER_X : Math.hypot(x, y) > SZ.ARC);
  };
  const show = (zi, e) => {
    if (root.dataset.sc === '1') return;
    pop.innerHTML = zoneTip(m.zones[zi], root.dataset.hl, team, share); pop.hidden = false;
    const rr = root.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, x = e.clientX - rr.left, y = e.clientY - rr.top;
    pop.style.left = Math.max(4, Math.min(rr.width - w - 4, x + 12 > rr.width - w - 4 ? x - w - 12 : x + 12)) + 'px';
    pop.style.top = Math.max(4, Math.min(rr.height - h - 4, y - h - 14 >= 4 ? y - h - 14 : y + 14)) + 'px';
  };
  const setHl = mode => { st.hl = mode; root.dataset.hl = mode || 'none'; root.querySelectorAll('[data-hl-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hlBtn === mode))); if (pinned) show(pinned.zone, pinned.e); };
  const setSc = on => { st.sc = on; root.dataset.sc = on ? 1 : 0; root.querySelectorAll('[data-sc-btn]').forEach(b => b.setAttribute('aria-pressed', String(on))); if (on) { pinned = null; hide(); } };
  root.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || pinned) return; const svg = e.target.closest('svg.sz-court'), z = svg ? zoneAt(svg, e) : -1; if (z >= 0) show(z, e); else hide(); });
  root.addEventListener('pointerleave', () => { if (!pinned) hide(); });
  root.addEventListener('click', e => {
    const t = e.target, view = t.closest('[data-shotview-btn]'), au = t.closest('[data-hl-btn]'), sc = t.closest('[data-sc-btn]'), svg = t.closest('svg.sz-court');
    if (view) {
      st.view = view.dataset.shotviewBtn; pinned = null; hide();
      if (st.view !== 'shots') { setHl(null); setSc(false); }
      root.querySelectorAll('[data-shotview-btn]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.shotviewBtn === st.view)));
      root.querySelectorAll('svg[data-shotview]').forEach(s => s.toggleAttribute('hidden', s.dataset.shotview !== st.view));
      root.querySelector('.sz-au').toggleAttribute('hidden', st.view !== 'shots'); return;
    }
    if (sc) { setSc(!st.sc); return; }
    if (au) { setHl(st.hl === au.dataset.hlBtn ? null : au.dataset.hlBtn); return; }
    if (svg) { const z = zoneAt(svg, e); if (z < 0) { pinned = null; hide(); return; } if (pinned && pinned.zone === z) { pinned = null; hide(); } else { pinned = { zone: z, e: { clientX: e.clientX, clientY: e.clientY } }; show(z, e); } }
  });
}
