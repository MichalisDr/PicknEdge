// Leaving the tables while they are still drawing: the pending draw must not put the table (or its error) over the page that replaced it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useRealData, siteFile, useIcons } from '../helpers/site-data.mjs';

const dummy = () => ({ addEventListener() {}, focus() {}, setSelectionRange() {}, hidden: true });
globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {}, body: {}, createElement: () => ({ getContext: () => ({ measureText: t => ({ width: t.length * 7 }) }) }) };
globalThis.getComputedStyle = () => ({ fontFamily: 'x' });
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(siteFile('config/table-layouts.json')) });
useRealData();
await useIcons();
const { Data } = await import('../../site/core/data.js');
const { mount } = await import('../../site/fantasy/tables/table-page.js');

/* #content: it stays connected for the whole visit; what is replaced on every write is its child, the page. */
function content() {
  let html = '', child = null;
  return {
    isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(v) { if (child) child.isConnected = false; html = v; child = { isConnected: true }; },
    get firstElementChild() { return child; },
    querySelector: s => (s === '.fw-fd-body' ? null : dummy()),
    querySelectorAll: () => [],
  };
}
const OTHER = '<section>another page</section>';
const settle = () => new Promise(r => setTimeout(r, 600));

test('another page opened while the table is loading stays on screen', async () => {
  const host = content();
  mount(host, 'teams');
  host.innerHTML = OTHER;
  await settle();
  assert.equal(host.innerHTML, OTHER);
});

test('a load that fails after leaving does not write its error over the other page', async () => {
  const view = Data.view;
  Data.view = async () => { throw new Error('offline'); };
  try {
    const host = content();
    mount(host, 'teams');
    host.innerHTML = OTHER;
    await settle();
    assert.equal(host.innerHTML, OTHER);
  } finally { Data.view = view; }
});

test('staying on the page still draws the table', async () => {
  const host = content();
  mount(host, 'teams');
  await settle();
  assert.match(host.innerHTML, /<table class="fw-t"/);
});
