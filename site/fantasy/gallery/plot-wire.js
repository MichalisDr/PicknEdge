/* Browser side of the scatter plots: draws each .fc-plot at its real width (and again when it resizes), brings the hovered logo to the front and shows its read-out
   (name and both values, the same pop-over as the per-game bars). Touch: the first tap on a logo shows the read-out, a second tap opens the card.
   Narrow = the container is below 520px: charts.css sets --fc-narrow:1 on the plot (the same container query as the card system); then the opened card is drawn at its width (narrowHeight) instead of filling a fixed height.
   A chart that asks for it (model.move: the players' price chart) slides its dots from the window it showed last to the one now chosen (tween.js): one requestAnimationFrame loop per chart,
   cancelled when a newer drawing starts, a jump instead with prefers-reduced-motion. What is on screen is remembered per chart across the table's redraws (the table is drawn anew on every change).
   mode 'full' = the opened card (logos, more ticks). onOpen(id) opens the card of a clicked logo; without it the click is left to the caller (the enlarged chart handles it). */
import { drawScatter, narrowHeight } from './scatter.js';
import { size } from '../../core/sizes.js';
import { between, ease, wantsMove } from './tween.js';

const onScreen = new Map();   // chart key -> { win, model }: the model last drawn (a half-way one while a move runs)
const running = new Map();    // chart key -> the function that stops its move

export function wirePlots(root, onOpen, win = globalThis.window, mode = 'thumb') {
  root.querySelectorAll('.fc-plot').forEach(plot => {
    const model = JSON.parse(plot.dataset.plot), canvas = plot.querySelector('.fc-canvas'), tip = plot.querySelector('.fc-tip');
    let width = 0, height = 0, narrow = false, touch = false, tipFor = '', coming = null;   // coming = the model to slide from, for the first drawing only
    if (model.move) {
      running.get(model.key)?.();
      const reduced = !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches, was = onScreen.get(model.key);
      if (mode === 'thumb' && wantsMove(was, model, reduced)) coming = was.model;
    }
    const render = m => { canvas.innerHTML = drawScatter(m, width, narrow, mode, height || undefined); if (model.move) onScreen.set(model.key, { win: model.win, model: m }); };
    const slide = from => {
      const ms = size('fantasy.charts-gallery.plot.move-ms'); let id = 0, t0 = null;
      const stop = () => { if (id) win.cancelAnimationFrame(id); id = 0; if (running.get(model.key) === stop) running.delete(model.key); };
      const step = ts => {
        t0 ??= ts;
        const k = Math.min(1, (ts - t0) / ms);
        if (!plot.isConnected) return stop();
        render(between(from, model, ease(k)));
        id = k < 1 ? win.requestAnimationFrame(step) : 0;
        if (k >= 1) stop();
      };
      running.set(model.key, stop);
      render(from);   // frame 0 is where the dots were: no flash of the new picture
      id = win.requestAnimationFrame(step);
    };
    const hide = () => { tip.hidden = true; tipFor = ''; };
    const draw = () => {
      const nar = win.getComputedStyle(plot).getPropertyValue('--fc-narrow').trim() === '1';
      const w = Math.round(plot.clientWidth), h = mode === 'full' ? (nar ? narrowHeight(model, w) : Math.round(plot.clientHeight)) : 0;   // the opened card fills the height of its stage (narrow: its width x aspect); thumbnails keep the aspect
      if (!w || (mode === 'full' && !h) || (w === width && h === height && nar === narrow)) return;
      width = w; height = h; narrow = nar; hide();
      if (coming) { const from = coming; coming = null; slide(from); } else { running.get(model.key)?.(); render(model); }
    };
    const show = g => {
      tip.textContent = g.dataset.tip; tip.hidden = false; tipFor = g.dataset.open;
      const half = tip.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(plot.clientWidth - half, +g.dataset.x)) + 'px';
      tip.style.top = (+g.dataset.y - 4) + 'px';
    };
    const pt = e => e.target.closest?.('.fc-pt');
    const lift = g => { if (!model.sized && g.nextElementSibling) g.parentNode.appendChild(g); };   // to the front; not where the dots have a size: the order largest-first keeps every small dot reachable
    plot.addEventListener('pointerdown', e => { touch = e.pointerType !== 'mouse'; });
    plot.addEventListener('pointerover', e => { const g = pt(e); if (!g || touch) return; lift(g); show(g); });   // already last = no move, so no flicker
    plot.addEventListener('pointerout', e => { if (pt(e) && !touch) hide(); });
    plot.addEventListener('focusin', e => { const g = pt(e); if (!g) return; lift(g); show(g); });   // the focused logo comes to the front too
    plot.addEventListener('focusout', e => { if (pt(e)) hide(); });
    plot.addEventListener('keydown', e => { const g = pt(e); if (g && onOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); onOpen(g.dataset.open); } });
    plot.addEventListener('click', e => {
      const g = pt(e);
      if (!g) { hide(); return; }
      if (touch && tipFor !== g.dataset.open) { e.stopPropagation(); lift(g); show(g); return; }
      if (onOpen) { e.stopPropagation(); onOpen(g.dataset.open); }
    });
    draw();
    if (win.ResizeObserver) new win.ResizeObserver(draw).observe(plot);
  });
}
