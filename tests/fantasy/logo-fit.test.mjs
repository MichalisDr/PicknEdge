// Team logos are placed by their visible artwork: the artwork box is fitted into the same square by its larger side, centred on the data point.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { logoFit, logoId } from '../../site/fantasy/gallery/logo-fit.js';
import { LOGO_BOUNDS } from '../../site/assets/logo-bounds.js';
import { TEAMS } from '../../site/assets/teams.js';

test('every catalogue logo has a bounding box inside its picture', () => {
  const files = readdirSync(new URL('../../site/assets/logos/', import.meta.url)).filter(f => f.endsWith('.png')).map(f => f.replace('.png', ''));
  for (const id of files) assert.ok(LOGO_BOUNDS[id], `bounds for ${id}`);
  for (const t of TEAMS) assert.ok(LOGO_BOUNDS[logoId(t.logo)], t.id);
  for (const [id, b] of Object.entries(LOGO_BOUNDS)) assert.ok(b.bw > 0 && b.bh > 0 && b.x >= 0 && b.y >= 0 && b.x + b.bw <= b.w && b.y + b.bh <= b.h, id);
});

test('the larger side of the visible artwork is exactly the box, and the artwork is centred on the point', () => {
  for (const t of TEAMS) {
    const b = LOGO_BOUNDS[logoId(t.logo)], g = logoFit(t.logo, 36), k = g.width / b.w;
    assert.ok(Math.abs(Math.max(b.bw, b.bh) * k - 36) < 1e-9, t.id);
    assert.ok(Math.abs(g.x + (b.x + b.bw / 2) * k) < 1e-9 && Math.abs(g.y + (b.y + b.bh / 2) * k) < 1e-9, t.id + ' centred');
  }
});
