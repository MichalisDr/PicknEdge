/* Theme editor page: shows the real site in a frame, lets you click an element to see the names of its colours and sizes, change them, and export the changed files.
   Appearance (colours, font size, radius, border, shadow) is theme.json; layout (width, height, margin, padding, gap, position) is ../config/sizes.json. The editor reads and
   writes only those two files (model: editor-model.js). The live preview is the same CSS the generators write, put on top of the page in the frame. */
import { parseTheme, serializeTheme, tokenIndex, setToken, setSize, resolve, isHex6, isColourValue } from './editor-model.js';
import { buildThemeCss } from './generate.mjs';
import { buildSizesCss } from '../config/generate.mjs';

const ROUTES = [['#fantasy', 'Fantasy · Teams'], ['#fantasy/players', 'Fantasy · Players'], ['#betting', 'Betting · Overview'], ['#manual', 'Betting · Manual analysis'], ['#saved', 'Betting · Saved'], ['#data', 'Betting · Statistics']];
const $ = id => document.getElementById(id);
const frame = $('ed-frame');
let originalText = '', originalSizesText = '', theme = null, sizes = null, originalTheme = null, originalSizes = null, selected = null;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const doc = () => frame.contentDocument;
const index = () => tokenIndex(theme, sizes);
const originalIndex = () => tokenIndex(originalTheme, originalSizes);

async function init() {
  originalText = await (await fetch('theme.json')).text();
  originalSizesText = await (await fetch('../config/sizes.json')).text();
  theme = parseTheme(originalText); originalTheme = parseTheme(originalText);
  sizes = parseTheme(originalSizesText); originalSizes = parseTheme(originalSizesText);
  $('ed-route').innerHTML = ROUTES.map(([h, t]) => `<option value="${h}">${t}</option>`).join('');
  $('ed-route').onchange = () => { frame.src = '../index.html' + $('ed-route').value; };
  $('ed-width').onchange = () => { frame.style.width = $('ed-width').value + 'px'; };
  $('ed-reset').onclick = () => { theme = parseTheme(originalText); sizes = parseTheme(originalSizesText); apply(); show(selected); };
  $('ed-export').onclick = () => download(serializeTheme(theme), 'theme.json');
  $('ed-export-sizes').onclick = () => download(serializeTheme(sizes), 'sizes.json');
  frame.onload = () => { installHandlers(); apply(); };
  frame.style.width = $('ed-width').value + 'px';
  frame.src = '../index.html' + $('ed-route').value;
  renderGeneral();
}

function apply() {
  const d = doc(); if (!d || !d.head) return;
  let st = d.getElementById('ed-theme');
  if (!st) { st = d.createElement('style'); st.id = 'ed-theme'; d.head.append(st); }
  st.textContent = buildThemeCss(theme) + buildSizesCss(sizes);
  renderGeneral();
}

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- which tokens style an element ---------- */
const STATE = /::?(?:hover|focus-visible|focus|active|backdrop|before|after|placeholder|selection)(?:\([^)]*\))?/g;
function tokensOf(el) {
  const byVar = new Map(index().filter(t => t.layer === 'component' || t.layer === 'layout').map(t => [t.cssVar, t]));
  const found = new Map();
  const visit = rules => {
    for (const r of rules) {
      if (r.cssRules && !r.selectorText) { visit(r.cssRules); continue; }
      if (!r.selectorText || r.selectorText === 'body' && /(theme|sizes)\.css$/.test(r.parentStyleSheet?.href || '')) continue;
      const hit = r.selectorText.split(',').some(s => { try { return el.matches(s.replace(STATE, '').trim() || '*'); } catch { return false; } });
      if (!hit) continue;
      for (const m of r.cssText.matchAll(/var\((--[\w-]+)\)/g)) { const t = byVar.get(m[1]); if (t && !found.has(t.key)) found.set(t.key, { t, selector: r.selectorText, stateful: new RegExp(STATE.source).test(r.selectorText) }); }
    }
  };
  for (const sheet of doc().styleSheets) { if (sheet.ownerNode?.id === 'ed-theme') continue; try { visit(sheet.cssRules); } catch { /* other origin */ } }
  return [...found.values()].sort((a, b) => a.stateful - b.stateful);   // what applies all the time first, hover / focus after
}

function show(el) {
  selected = el;
  if (!el) return;
  const chain = []; for (let e = el, i = 0; e && e.nodeType === 1 && i < 14 && e.tagName !== 'HTML'; e = e.parentElement, i++) chain.push(e);
  const parts = chain.map((e, i) => ({ e, i, list: tokensOf(e) })).filter(p => p.list.length);
  const firstToken = (parts.flatMap(p => p.list).find(x => !x.stateful) || parts[0]?.list[0])?.t;
  $('ed-title').textContent = firstToken?.key.split('.').slice(0, 3).join(' > ') || 'Nothing named here';
  $('ed-hint').hidden = true;
  const group = (title, list) => list.length ? `<h4 class="ed-group">${title}</h4>` + list.map(x => row(x.t, x.selector)).join('') : '';
  $('ed-element').innerHTML = parts.map(p => `<h3 class="ed-sub">${p.i ? 'Parent: ' : ''}&lt;${p.e.tagName.toLowerCase()}${p.e.className && typeof p.e.className === 'string' ? '.' + esc(p.e.className.trim().split(/\s+/).join('.')) : ''}&gt;</h3>`
    + group('Colours', p.list.filter(x => x.t.layer === 'component' && isColourValue(x.t.value))) + group('Appearance sizes (theme.json)', p.list.filter(x => x.t.layer === 'component' && !isColourValue(x.t.value))) + group('Layout (sizes.json)', p.list.filter(x => x.t.layer === 'layout'))).join('') || '<p class="ed-hint">Nothing here has its own name: look at the parent elements or the general colours.</p>';
  bindRows($('ed-element'));
}

/* ---------- rows ---------- */
const current = t => index().find(x => x.cssVar === t.cssVar);
const originalValue = t => originalIndex().find(x => x.cssVar === t.cssVar)?.value;
function row(t, selector, wide = false) {
  const now = current(t).value, changed = now !== originalValue(t);
  const cls = `ed-row${changed ? ' changed' : ''}${wide ? ' ed-wide' : ''}`;
  const undo = changed ? '<button type="button" class="ed-undo">Undo</button>' : '';
  if (t.layer === 'layout' || !isColourValue(now)) {   // a size: number field for a plain px / number, text for anything else (e.g. "6px 12px")
    const plain = /^-?[\d.]+(px)?$/.test(now);
    return `<div class="${cls}" data-var="${t.cssVar}"><span class="ed-sw ed-size">${t.layer === 'layout' ? '↔' : 'Aa'}</span>
      <div><div class="ed-name">${esc(t.key)}</div><div class="ed-sub">${esc(selector || '')}</div>
      ${plain ? `<input type="number" step="any" class="ed-num" value="${parseFloat(now)}" aria-label="${esc(t.key)}"> ${/px$/.test(now) ? 'px' : ''}` : `<input type="text" class="ed-text" value="${esc(now)}" aria-label="${esc(t.key)}">`}</div>${undo}</div>`;
  }
  const colour = resolve(theme, now), pick = isHex6(colour || '');
  const semantic = Object.keys(theme.semantic).filter(k => typeof theme.semantic[k] === 'string');
  const link = now.startsWith('{') ? now.slice(1, -1) : 'own colour';
  return `<div class="${cls}" data-var="${t.cssVar}">
    ${pick ? `<input type="color" value="${colour}" aria-label="${esc(t.key)}">` : `<span class="ed-sw" style="background:${esc(colour || 'transparent')}"></span>`}
    <div><div class="ed-name">${esc(t.key)}</div><div class="ed-sub">${esc(link)}${selector ? ' · ' + esc(selector) : ''} · ${esc(colour || '')}</div>
    ${t.layer === 'component' ? `<select class="ed-ref" aria-label="Point at a general colour"><option value="">Point at…</option>${semantic.map(k => `<option value="{semantic.${k}}">${k}</option>`).join('')}</select>` : ''}</div>${undo}</div>`;
}
function change(t, value) { if (t.layer === 'layout') sizes = setSize(sizes, t, value); else theme = setToken(theme, t, value); apply(); show(selected); }
function bindRows(root) {
  root.querySelectorAll('.ed-row').forEach(r => {
    const t = index().find(x => x.cssVar === r.dataset.var);
    const color = r.querySelector('input[type=color]'); if (color) color.oninput = () => change(t, color.value);
    const ref = r.querySelector('.ed-ref'); if (ref) ref.onchange = () => { if (ref.value) change(t, ref.value); };
    const num = r.querySelector('.ed-num'); if (num) num.onchange = () => { if (num.value !== '') change(t, num.value + (/px$/.test(current(t).value) ? 'px' : '')); };
    const text = r.querySelector('.ed-text'); if (text) text.onchange = () => change(t, text.value);
    const undo = r.querySelector('.ed-undo'); if (undo) undo.onclick = () => change(t, originalValue(t));
  });
}
function renderGeneral() {
  const idx = index();
  $('ed-semantic').innerHTML = idx.filter(t => t.layer === 'semantic').map(t => row(t, '', true)).join('');
  $('ed-palette').innerHTML = idx.filter(t => t.layer === 'palette').map(t => row(t, '', true)).join('');
  bindRows($('ed-semantic')); bindRows($('ed-palette'));
}

/* ---------- picking in the frame ---------- */
function installHandlers() {
  const d = doc(); if (!d) return;
  let hl = d.getElementById('ed-hl');
  if (!hl) { hl = d.createElement('div'); hl.id = 'ed-hl'; hl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;outline:2px solid var(--color-accent-default);outline-offset:-1px;display:none'; d.body.append(hl); }
  d.addEventListener('mouseover', e => { if (!$('ed-pick').checked || e.target === hl) { hl.style.display = 'none'; return; } const r = e.target.getBoundingClientRect(); Object.assign(hl.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }, true);
  d.addEventListener('click', e => { if (!$('ed-pick').checked) return; e.preventDefault(); e.stopPropagation(); show(e.target); }, true);
}

init();
