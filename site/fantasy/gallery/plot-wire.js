/* Browser side of the scatter plots: draws each .fc-plot at its real width (and again when it resizes), brings the hovered logo to the front and shows its read-out
   (name and both values, the same pop-over as the per-game bars). Touch: the first tap on a logo shows the read-out, a second tap opens the card.
   mode 'full' = the opened card (logos, more ticks). onOpen(id) opens the card of a clicked logo; without it the click is left to the caller (the enlarged chart handles it). */
import { drawScatter } from './scatter.js';

export function wirePlots(root, onOpen, win = globalThis.window, mode = 'thumb') {
  root.querySelectorAll('.fc-plot').forEach(plot => {
    const model = JSON.parse(plot.dataset.plot), canvas = plot.querySelector('.fc-canvas'), tip = plot.querySelector('.fc-tip');
    let width = 0, height = 0, touch = false, tipFor = '';
    const hide = () => { tip.hidden = true; tipFor = ''; };
    const draw = () => {
      const w = Math.round(plot.clientWidth), h = mode === 'full' ? Math.round(plot.clientHeight) : 0;   // the opened card fills the height of its stage; thumbnails keep the aspect
      if (!w || (mode === 'full' && !h) || (w === width && h === height)) return;
      width = w; height = h; hide();
      canvas.innerHTML = drawScatter(model, w, win.matchMedia('(max-width:650px)').matches, mode, h || undefined);
    };
    const show = g => {
      tip.textContent = g.dataset.tip; tip.hidden = false; tipFor = g.dataset.open;
      const half = tip.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(plot.clientWidth - half, +g.dataset.x)) + 'px';
      tip.style.top = (+g.dataset.y - 4) + 'px';
    };
    const pt = e => e.target.closest?.('.fc-pt');
    plot.addEventListener('pointerdown', e => { touch = e.pointerType !== 'mouse'; });
    plot.addEventListener('pointerover', e => { const g = pt(e); if (!g || touch) return; if (g.nextElementSibling) g.parentNode.appendChild(g); show(g); });   // already last = no move, so no flicker
    plot.addEventListener('pointerout', e => { if (pt(e) && !touch) hide(); });
    plot.addEventListener('focusin', e => { const g = pt(e); if (g) show(g); });
    plot.addEventListener('focusout', e => { if (pt(e)) hide(); });
    plot.addEventListener('keydown', e => { const g = pt(e); if (g && onOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); onOpen(g.dataset.open); } });
    plot.addEventListener('click', e => {
      const g = pt(e);
      if (!g) { hide(); return; }
      if (touch && tipFor !== g.dataset.open) { e.stopPropagation(); if (g.nextElementSibling) g.parentNode.appendChild(g); show(g); return; }
      if (onOpen) { e.stopPropagation(); onOpen(g.dataset.open); }
    });
    draw();
    if (win.ResizeObserver) new win.ResizeObserver(draw).observe(plot);
  });
}
