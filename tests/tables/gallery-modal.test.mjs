// Gallery card -> large <dialog>: click or Enter opens it, Esc (cancel) closes it and focus returns to the card; a point click does not open it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../../site/fantasy-gallery.js', import.meta.url), 'utf8');

function setup() {
  const listeners = {}, body = [];
  const node = (html) => ({ html, onclick: null, oncancel: null, open: false, removed: false, className: '',
    set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; },
    querySelector() { return { onclick: null }; }, showModal() { this.open = true; }, close() { this.open = false; }, remove() { this.removed = true; } });
  const document = { addEventListener: (t, f) => { listeners[t] = f; }, createElement: () => node(''), body: { append: d => body.push(d) } };
  const opened = [];
  const g = { PicknEdgeData: {}, PicknEdgeWindows: { esc: s => s }, document, addEventListener() {}, FantasyCards: { open: (...a) => opened.push(a) } };
  g.globalThis = g;
  vm.runInNewContext(src, Object.assign(g, { document }), { filename: 'fantasy-gallery.js' });
  const part = cls => ({ innerHTML: cls, outerHTML: `<x class="${cls}"/>` });
  const card = { isConnected: true, focused: 0, focus() { this.focused++; },
    closest: sel => (sel === '.fc-gallery' ? { dataset: { entity: 'teams', win: 'season' } } : sel === '.fc-grid-gallery .fc-card' ? card : null),
    querySelector: sel => part(sel), querySelectorAll: () => [part('fc-note')] };
  card.self = card;
  return { listeners, body, card, opened, g };
}

test('click on a card opens a dialog with the scatter; cancel (Esc) closes it and focus returns to the card', () => {
  const { listeners, body, card } = setup();
  listeners.click({ target: card });
  assert.equal(body.length, 1);
  const dlg = body[0];
  assert.ok(dlg.open && dlg.className.includes('fw-dialog'));
  assert.ok(dlg.html.includes('.fc-svg') && dlg.html.includes('fc-mhead'));
  let prevented = false;
  dlg.oncancel({ preventDefault: () => { prevented = true; } });
  assert.ok(prevented && dlg.removed && !dlg.open);
  assert.equal(card.focused, 1);
});

test('Enter and Space on a focused card open the dialog', () => {
  for (const key of ['Enter', ' ']) {
    const { listeners, body, card } = setup();
    listeners.keydown({ target: card, key, preventDefault() {} });
    assert.equal(body.length, 1, key);
  }
});

test('a click on a point does not open the dialog', () => {
  const { listeners, body, card } = setup();
  const pt = { closest: sel => (sel === '.fc-pt' ? {} : sel === '.fc-grid-gallery .fc-card' ? card : null) };
  listeners.click({ target: pt });
  assert.equal(body.length, 0);
});

test('backdrop click closes; a point click in the dialog opens the player/team card', () => {
  const { listeners, body, card, opened } = setup();
  listeners.click({ target: card });
  const dlg = body[0];
  dlg.onclick({ target: { closest: sel => (sel === '.fc-pt[data-open]' ? { dataset: { open: 'BAR' } } : null) } });
  assert.equal(JSON.stringify(opened), JSON.stringify([['teams', 'BAR', { win: 'season' }]]));
  assert.ok(dlg.removed);
  const s2 = setup();
  s2.listeners.click({ target: s2.card });
  s2.body[0].onclick({ target: s2.body[0] });
  assert.ok(s2.body[0].removed);
});

test('cards are focusable buttons with a chart id', () => {
  assert.match(src, /class="fc-card" tabindex="0" role="button" data-chart-id=/);
});
