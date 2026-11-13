/* Click, Enter or Space on a gallery chart opens the same scatter large in a <dialog> (same pattern as the cards). One delegated listener on the document, so it survives every re-render.
   Installed once by app/main.js; openCard opens the card of a clicked point. */
export function installGalleryDialog({ doc = document, win = window, openCard }) {
  let dlg = null;
  function close() { if (dlg) { dlg.close(); dlg.remove(); dlg = null; } }
  function open(card) {
    close();
    const gal = card.closest('.fc-gallery');
    dlg = doc.createElement('dialog');
    dlg.className = 'fw-dialog fc-dialog';
    dlg.innerHTML = '<button class="fw-close" aria-label="Close chart">×</button><header class="fc-mhead"><h2>' + card.querySelector('.fc-card-title').innerHTML + '<small>' + card.querySelector('.fc-card-sub').innerHTML + '</small></h2></header><div class="fc-stage">' + card.querySelector('.fc-svg').outerHTML + '</div>' + [...card.querySelectorAll('.fc-note')].map(n => n.outerHTML).join('');
    doc.body.append(dlg);
    const mine = dlg, done = () => { if (dlg === mine) close(); if (card.isConnected) card.focus(); };
    mine.querySelector('.fw-close').onclick = done;
    mine.oncancel = e => { e.preventDefault(); done(); };
    mine.onclick = e => {
      if (e.target === mine) return done();
      const pt = e.target.closest('.fc-pt[data-open]');
      if (pt) { close(); openCard(gal.dataset.entity, pt.dataset.open, { win: gal.dataset.win }); }
    };
    mine.showModal();
  }
  doc.addEventListener('click', e => { const card = e.target.closest('.fc-grid-gallery .fc-card'); if (card && !e.target.closest('.fc-pt')) open(card); });
  doc.addEventListener('keydown', e => { const card = e.target.closest?.('.fc-grid-gallery .fc-card'); if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(card); } });
  win.addEventListener('hashchange', close);
}
