/* Theme editor page: shows the real site in a frame, lets you click an element to see the names of its colours, change them, and export the changed theme.json.
   Reads and writes only theme.json (model: editor-model.js). The live preview is the same CSS the generator writes (generate.mjs), put on top of the page in the frame. */
import { parseTheme, serializeTheme, tokenIndex, setToken, resolve, isHex6 } from './editor-model.js';
import { buildThemeCss } from './generate.mjs';

const ROUTES = [['#fantasy', 'Fantasy · Teams'], ['#fantasy/players', 'Fantasy · Players'], ['#betting', 'Betting · Overview'], ['#manual', 'Betting · Manual analysis'], ['#saved', 'Betting · Saved'], ['#data', 'Betting · Statistics']];
const $ = id => document.getElementById(id);
const frame = $('ed-frame');
let original = '', theme = null, originalTheme = null, selected = null;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const doc = () => frame.contentDocument;

async function init() {
  original = await (await fetch('theme.json')).text();
  theme = parseTheme(original); originalTheme = parseTheme(original);
  $('ed-route').innerHTML = ROUTES.map(([h, t]) => `<option value="${h}">${t}</option>`).join('');
  $('ed-route').onchange = () => { frame.src = '../index.html' + $('ed-route').value; };
  $('ed-width').onchange = () => { frame.style.width = $('ed-width').value + 'px'; };
  $('ed-reset').onclick = () => { theme = parseTheme(original); apply(); show(selected); };
  $('ed-export').onclick = exportTheme;
  frame.onload = () => { installHandlers(); apply(); };
  frame.style.width = $('ed-width').value + 'px';
  frame.src = '../index.html' + $('ed-route').value;
  renderGeneral();
}

function apply() {
  const d = doc(); if (!d || !d.head) return;
  let st = d.getElementById('ed-theme');
  if (!st) { st = d.createElement('style'); st.id = 'ed-theme'; d.head.append(st); }
  st.textContent = buildThemeCss(theme);
  renderGeneral();
}

function exportTheme() {
  const url = URL.createObjectURL(new Blob([serializeTheme(theme)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'theme.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- which tokens style an element ---------- */
const STATE = /::?(?:hover|focus-visible|focus|active|backdrop|before|after|placeholder|selection)(?:\([^)]*\))?/g;
function tokensOf(el) {
  const byVar = new Map(tokenIndex(theme).filter(t => t.layer === 'component').map(t => [t.cssVar, t]));
  const found = new Map();
  const visit = rules => {
    for (const r of rules) {
      if (r.cssRules && !r.selectorText) { visit(r.cssRules); continue; }
      if (!r.selectorText || r.selectorText === 'body' && r.parentStyleSheet?.href?.endsWith('theme.css')) continue;
      const hit = r.selectorText.split(',').some(s => { try { return el.matches(s.replace(STATE, '').trim() || '*'); } catch { return false; } });
      if (!hit) continue;
      for (const m of r.cssText.matchAll(/var\((--[\w-]+)\)/g)) { const t = byVar.get(m[1]); if (t && !found.has(t.key)) found.set(t.key, { t, selector: r.selectorText, stateful: new RegExp(STATE.source).test(r.selectorText) }); }
    }
  };
  for (const sheet of doc().styleSheets) { if (sheet.ownerNode?.id === 'ed-theme') continue; try { visit(sheet.cssRules); } catch { /* other origin */ } }
  return [...found.values()].sort((a, b) => a.stateful - b.stateful);   // colours that apply all the time first, hover / focus colours after
}

function show(el) {
  selected = el;
  if (!el) return;
  const chain = []; for (let e = el, i = 0; e && e.nodeType === 1 && i < 14 && e.tagName !== 'HTML'; e = e.parentElement, i++) chain.push(e);
  const parts = chain.map((e, i) => ({ e, i, list: tokensOf(e) })).filter(p => p.list.length);
  const firstToken = (parts.flatMap(p => p.list).find(x => !x.stateful) || parts[0]?.list[0])?.t;
  const first = firstToken?.key.split('.').slice(0, 3).join(' > ');
  $('ed-title').textContent = first || 'No themed colour here';
  $('ed-hint').hidden = true;
  $('ed-element').innerHTML = parts.map(p => `<h3 class="ed-sub">${p.i ? 'Parent: ' : ''}&lt;${p.e.tagName.toLowerCase()}${p.e.className && typeof p.e.className === 'string' ? '.' + esc(p.e.className.trim().split(/\s+/).join('.')) : ''}&gt;</h3>` + p.list.map(x => row(x.t, x.selector)).join('')).join('') || '<p class="ed-hint">The colours here come from the parent elements or from a general colour.</p>';
  bindRows($('ed-element'));
}

/* ---------- rows ---------- */
const current = t => tokenIndex(theme).find(x => x.cssVar === t.cssVar);
const originalValue = t => tokenIndex(originalTheme).find(x => x.cssVar === t.cssVar)?.value;
function row(t, selector, wide = false) {
  const now = current(t).value, colour = resolve(theme, now), pick = isHex6(colour || '');
  const changed = now !== originalValue(t);
  const semantic = Object.keys(theme.semantic).filter(k => typeof theme.semantic[k] === 'string');
  const link = now.startsWith('{') ? now.slice(1, -1) : 'own colour';
  return `<div class="ed-row${changed ? ' changed' : ''}${wide ? ' ed-wide' : ''}" data-var="${t.cssVar}">
    ${pick ? `<input type="color" value="${colour}" aria-label="${esc(t.key)}">` : `<span class="ed-sw" style="background:${esc(colour || 'transparent')}"></span>`}
    <div><div class="ed-name">${esc(t.key)}</div><div class="ed-sub">${esc(link)}${selector ? ' · ' + esc(selector) : ''} · ${esc(colour || '')}</div>
    ${t.layer === 'component' ? `<select class="ed-ref" aria-label="Point at a general colour"><option value="">Point at…</option>${semantic.map(k => `<option value="{semantic.${k}}">${k}</option>`).join('')}</select>` : ''}</div>
    ${changed ? '<button type="button" class="ed-undo">Undo</button>' : ''}</div>`;
}
function bindRows(root) {
  root.querySelectorAll('.ed-row').forEach(r => {
    const t = tokenIndex(theme).find(x => x.cssVar === r.dataset.var);
    const color = r.querySelector('input[type=color]'); if (color) color.oninput = () => { theme = setToken(theme, t, color.value); apply(); show(selected); };
    const ref = r.querySelector('.ed-ref'); if (ref) ref.onchange = () => { if (ref.value) { theme = setToken(theme, t, ref.value); apply(); show(selected); } };
    const undo = r.querySelector('.ed-undo'); if (undo) undo.onclick = () => { theme = setToken(theme, t, originalValue(t)); apply(); show(selected); };
  });
}
function renderGeneral() {
  const idx = tokenIndex(theme);
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
