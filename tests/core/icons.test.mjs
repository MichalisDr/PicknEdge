// Icons: assets/icons holds SVGs drawn with currentColor only; core/icons.js inlines one by name, so its colour comes from the element around it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { icon, loadIcons, checkIcon } from '../../site/core/icons.js';

const good = '<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" fill="none"/></svg>';

test('an icon is inlined by name, sized to the text, hidden from screen readers; a label makes it an image', async () => {
  await loadIcons(['arrow'], async () => good);
  assert.match(icon('arrow'), /^<svg class="fw-icon" width="1em" height="1em" focusable="false" aria-hidden="true" viewBox="0 0 24 24">/);
  assert.match(icon('arrow', 'Next'), /role="img" aria-label="Next"/);
  assert.ok(icon('arrow').includes('stroke="currentColor"'));
});

test('an icon is fetched once, and using one that was never loaded is an error', async () => {
  let calls = 0;
  await loadIcons(['once'], async () => { calls++; return good; });
  await loadIcons(['once'], async () => { calls++; return good; });
  assert.equal(calls, 1);
  assert.throws(() => icon('missing'), /not loaded/);
});

test('raw colours are refused: hex, rgb, hsl, or any fill / stroke other than currentColor / none', () => {
  for (const bad of ['<svg><path fill="#fff"/></svg>', '<svg><path stroke="rgb(1,2,3)"/></svg>', '<svg><path fill="red"/></svg>', '<svg style="fill:blue"></svg>', '<img>'])
    assert.throws(() => checkIcon('x', bad), /icon x/, bad);
  assert.equal(checkIcon('x', good), good);
});
