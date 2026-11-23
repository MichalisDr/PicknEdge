// Narrow (container below 520px): the opened card follows its content; the plot is drawn at the card width, an x = y plot is exactly as tall as its square.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { narrowHeight } from '../../site/fantasy/gallery/scatter.js';

test('narrowHeight: an x = y chart is exactly as tall as its square plot (no empty band above it); others use the narrow aspect', () => {
  const eq = narrowHeight({ equal: true }, 306), other = narrowHeight({ equal: false }, 306);
  assert.equal(eq, 306 - 48 - 16 + 16 + 48);
  assert.equal(other, Math.round(306 * 1.25));
});

test('narrow: the card body height follows its content, wide keeps the 88% window', () => {
  const css = readFileSync(new URL('../../site/theme/fantasy/charts.css', import.meta.url), 'utf8');
  const narrow = css.slice(css.indexOf('@container fc (max-width:519px)'));
  assert.ok(narrow.includes('.fc-body{height:auto}') && narrow.includes('.fc-stage .fc-plot,.fc-stage .fc-canvas{height:auto}'));
  assert.ok(css.includes('.fc-body{display:flex;flex-direction:column;height:var(--fantasy-charts-gallery-enlarged-chart-body-height-wide)}'));
});
