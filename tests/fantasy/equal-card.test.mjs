// Wide (container 780px and up), x = y charts: the notes and a short legend are a column beside the square plot; charts whose axes do not share a scale keep the notes below and use the card width.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installGalleryDialog } from '../../site/fantasy/gallery/gallery-dialog.js';
import { CHARTS } from '../../site/fantasy/gallery/charts.js';

function open(dataset) {
  const listeners = {}, body = [];
  const node = () => ({ html: '', set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; }, querySelector() { return { onclick: null }; }, querySelectorAll() { return []; }, showModal() {}, close() {}, remove() {} });
  installGalleryDialog({ doc: { addEventListener: (t, f) => { listeners[t] = f; }, createElement: node, body: { append: d => body.push(d) } }, win: { addEventListener() {} }, openCard() {} });
  const part = cls => ({ innerHTML: cls, outerHTML: `<x class="${cls}"/>` });
  const card = { dataset, isConnected: true, focus() {}, closest: sel => (sel === '.fc-gallery' ? { dataset: {} } : sel === '.fc-grid-gallery .fc-card' ? card : null), querySelector: sel => part(sel), querySelectorAll: () => [part('fc-note')] };
  listeners.click({ target: card });
  return body[0].html;
}

test('an x = y chart opens with the data-equal flag and a short legend in the aside; other charts have neither', () => {
  const eq = open({ equal: '' }), other = open({});
  assert.ok(eq.includes('class="fc-body" data-equal') && eq.includes('class="fc-legend"') && eq.includes('class="fc-aside"'));
  assert.ok(!other.includes('data-equal') && !other.includes('fc-legend') && other.includes('class="fc-aside"'));
});

test('exactly the charts with equal axes are flagged equal in the gallery', () => {
  assert.deepEqual(CHARTS.filter(c => c.equal).map(c => c.id), ['teams-expected-efg']);
});

test('wide x = y: square plot left, aside right, legend shown, the long key note hidden; legend hidden otherwise', () => {
  const css = readFileSync(new URL('../../site/theme/fantasy/charts.css', import.meta.url), 'utf8');
  const wide = css.slice(css.indexOf('@container fc (min-width:780px)'), css.indexOf('@container fc (max-width:519px)'));
  for (const piece of ['.fc-body[data-equal] .fc-main{display:grid', 'aspect-ratio:1', '.fc-body[data-equal] .fc-legend{display:flex}', '.fc-body[data-equal] .fc-note-key{display:none}']) assert.ok(wide.includes(piece), piece);
  assert.ok(/\.fc-legend\{display:none;/.test(css), 'the legend is hidden below 780px');
});
