// Parts added for the design batches: every one has its theme, sizes and arrangement entries, carries its own name, and the toolbar and the card never share a switch-button key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const SITE = new URL('../../site/', import.meta.url);
const read = rel => readFileSync(new URL(rel, SITE), 'utf8');
const theme = JSON.parse(read('theme/theme.json')), sizes = JSON.parse(read('config/sizes.json')), arrangement = JSON.parse(read('config/arrangement.json'));
const walk = (dir, ext, out = []) => {
  for (const e of readdirSync(new URL(dir, SITE), { withFileTypes: true })) {
    const rel = dir + e.name + (e.isDirectory() ? '/' : '');
    if (e.isDirectory()) { if (e.name !== 'data') walk(rel, ext, out); } else if (ext.some(x => e.name.endsWith(x))) out.push(rel);
  }
  return out;
};
const has = (json, screen, comp, part) => !!json.component[screen]?.[comp]?.[part];
/** A part is in the arrangement as a container of its own or as a part listed in a container of the same component. */
const arranged = (screen, comp, name) => !!arrangement.component[screen]?.[comp]?.[name] || Object.values(arrangement.component[screen]?.[comp] || {}).some(c => (c.parts || []).some(p => p.name === name));

// [theme and sizes part, name in the arrangement]
const NEW_PARTS = {
  'fantasy.player-card': [['header-actions', 'header-actions'], ['header-portrait', 'header-portrait'], ['header-portrait-fade', 'header-portrait-fade'], ['header-given-name', 'header-given-name'], ['header-name', 'name'], ['value-sparkline', 'value-sparkline'],
    ['window-buttons', 'window-buttons'], ['view-buttons', 'view-button']],
  'fantasy.stat-table': [['window-buttons', 'window-buttons'], ['view-buttons', 'view-button']],
};

test('every new part has theme, sizes and arrangement entries', () => {
  for (const [path, parts] of Object.entries(NEW_PARTS)) {
    const [screen, comp] = path.split('.');
    for (const [part, name] of parts) {
      assert.ok(has(theme, screen, comp, part), `${path}.${part}: no theme entry`);
      assert.ok(has(sizes, screen, comp, part), `${path}.${part}: no sizes entry`);
      assert.ok(arranged(screen, comp, name), `${path}.${part}: no arrangement entry (${name})`);
    }
  }
});

test('toolbar and card each have all of: switch, window and view button (container, button, selected button), with the same properties', () => {
  for (const kind of ['switch', 'window', 'view']) for (const part of [kind + '-buttons', kind + '-button', kind + '-button-selected']) {
    for (const [json, label] of [[theme, 'theme'], [sizes, 'sizes']]) {
      if (label === 'sizes' && part.endsWith('-selected')) continue;   // a selected button only changes colours
      const a = json.component.fantasy['stat-table'][part], b = json.component.fantasy['player-card'][part];
      assert.ok(a && b, `${label}: ${part} missing in the toolbar or in the card`);
      assert.deepEqual(Object.keys(b), Object.keys(a), `${label}: ${part}`);
    }
  }
});

test('toolbar and card switch buttons are driven by different keys: no rule of the toolbar reads a card key, and no rule of the card reads a toolbar key', () => {
  const sheets = walk('theme/', ['.css']).filter(f => !/theme\.css$|editor\.css$/.test(f)).map(read);
  let toolbar = 0, card = 0;
  for (const css of sheets) for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const inCard = /\.fw-card\b/.test(m[1]);
    for (const v of m[2].matchAll(/var\(--fantasy-(stat-table|player-card)-((?:switch|window|view)-button[\w-]*)\)/g)) {
      if (v[1] === 'stat-table') { toolbar++; assert.ok(!inCard, `a card rule reads the toolbar key ${v[0]}`); }
      else { card++; assert.ok(inCard, `a rule outside the card reads the card key ${v[0]}`); }
    }
  }
  assert.ok(toolbar >= 20 && card >= 20, `both places are styled by their own keys (${toolbar}, ${card})`);
});

test('the markup names its parts: each data-part in a script is the key of a part that exists', () => {
  const known = new Set();
  for (const json of [theme, sizes]) for (const [s, cs] of Object.entries(json.component)) for (const [c, ps] of Object.entries(cs)) for (const p of Object.keys(ps)) known.add(`${s}.${c}.${p}`);
  const used = [];
  for (const f of walk('', ['.js']).filter(f => !f.startsWith('theme/'))) {
    const src = read(f);
    for (const m of src.matchAll(/data-part="(fantasy\.[\w.-]+)"/g)) used.push(m[1]);
    for (const m of src.matchAll(/data-part="\$\{PART\}([\w-]+)"/g)) used.push('fantasy.player-card.' + m[1]);
  }
  assert.ok(used.length >= 8, 'the new parts are named');
  for (const k of used) assert.ok(known.has(k), `data-part="${k}" is not a key in the theme or sizes`);
});
