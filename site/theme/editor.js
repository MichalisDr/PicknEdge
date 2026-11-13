/* Name finder: shows the real site in a frame; click an element to see the names of its colours, appearance sizes (theme.json) and layout sizes
   (../config/sizes.json), their current values, and the style-sheet selectors that use them. It changes nothing: to restyle, change that one entry in the file. */
const ROUTES = [['#fantasy', 'Fantasy · Teams'], ['#fantasy/players', 'Fantasy · Players'], ['#betting', 'Betting · Overview'], ['#manual', 'Betting · Manual analysis'], ['#saved', 'Betting · Saved'], ['#data', 'Betting · Statistics']];
const $ = id => document.getElementById(id);
const frame = $('ed-frame');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tokens = new Map();   // css variable -> { key, file, raw }

function collect(file, json) {
  for (const [screen, comps] of Object.entries(json.component))
    for (const [comp, parts] of Object.entries(comps))
      for (const [part, props] of Object.entries(parts))
        for (const [prop, raw] of Object.entries(props)) tokens.set(`--${screen}-${comp}-${part}-${prop}`, { key: `${screen}.${comp}.${part}.${prop}`, file, raw: String(raw) });
}

async function init() {
  collect('theme.json', await (await fetch('theme.json')).json());
  collect('config/sizes.json', await (await fetch('../config/sizes.json')).json());
  $('ed-route').innerHTML = ROUTES.map(([h, t]) => `<option value="${h}">${t}</option>`).join('');
  $('ed-route').onchange = () => { frame.src = '../index.html' + $('ed-route').value; };
  $('ed-width').onchange = () => { frame.style.width = $('ed-width').value + 'px'; };
  frame.onload = installHandlers;
  frame.style.width = $('ed-width').value + 'px';
  frame.src = '../index.html' + $('ed-route').value;
}

/* ---------- which names style an element ---------- */
const STATE = /::?(?:hover|focus-visible|focus|active|backdrop|before|after|placeholder|selection)(?:\([^)]*\))?/g;
function namesOf(el) {
  const found = new Map();
  const visit = rules => {
    for (const r of rules) {
      if (r.cssRules && !r.selectorText) { visit(r.cssRules); continue; }
      if (!r.selectorText) continue;
      const hit = r.selectorText.split(',').some(s => { try { return el.matches(s.replace(STATE, '').trim() || '*'); } catch { return false; } });
      if (!hit) continue;
      for (const m of r.cssText.matchAll(/var\((--[\w-]+)\)/g)) { const t = tokens.get(m[1]); if (t && !found.has(t.key)) found.set(t.key, { ...t, cssVar: m[1], selector: r.selectorText, stateful: new RegExp(STATE.source).test(r.selectorText) }); }
    }
  };
  for (const sheet of frame.contentDocument.styleSheets) { try { visit(sheet.cssRules); } catch { /* other origin */ } }
  return [...found.values()].sort((a, b) => a.stateful - b.stateful);   // what applies all the time first, hover / focus after
}

const kindOf = t => t.file !== 'theme.json' ? 'Layout' : /^(#|\{)/.test(t.raw) ? 'Colour' : 'Appearance size';
function show(el) {
  const d = frame.contentDocument;
  const chain = []; for (let e = el, i = 0; e && e.nodeType === 1 && i < 14 && e.tagName !== 'HTML'; e = e.parentElement, i++) chain.push(e);
  const parts = chain.map((e, i) => ({ e, i, list: namesOf(e) })).filter(p => p.list.length);
  const first = (parts.flatMap(p => p.list).find(x => !x.stateful) || parts[0]?.list[0]);
  $('ed-title').textContent = first ? first.key.split('.').slice(0, 3).join(' > ') : 'Nothing named here';
  $('ed-hint').hidden = true;
  const value = t => d.defaultView.getComputedStyle(d.body).getPropertyValue(t.cssVar).trim();
  const line = t => `<div class="ed-row"><div><div class="ed-name">${esc(t.key)}</div><div class="ed-sub">${kindOf(t)} · now <b>${esc(value(t))}</b>${/^\{/.test(t.raw) ? ' · ' + esc(t.raw.slice(1, -1)) : ''} · in ${esc(t.file)}</div><div class="ed-sub">${esc(t.selector)}</div></div></div>`;
  $('ed-element').innerHTML = parts.map(p => `<h3 class="ed-sub">${p.i ? 'Parent: ' : ''}&lt;${p.e.tagName.toLowerCase()}${p.e.className && typeof p.e.className === 'string' ? '.' + esc(p.e.className.trim().split(/\s+/).join('.')) : ''}&gt;</h3>` + p.list.map(line).join('')).join('')
    || '<p class="ed-hint">Nothing here has its own name: look at the parent elements.</p>';
}

/* ---------- picking in the frame ---------- */
function installHandlers() {
  const d = frame.contentDocument; if (!d) return;
  let hl = d.getElementById('ed-hl');
  if (!hl) { hl = d.createElement('div'); hl.id = 'ed-hl'; hl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;outline:2px solid var(--color-accent-default);outline-offset:-1px;display:none'; d.body.append(hl); }
  d.addEventListener('mouseover', e => { if (!$('ed-pick').checked || e.target === hl) { hl.style.display = 'none'; return; } const r = e.target.getBoundingClientRect(); Object.assign(hl.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }, true);
  d.addEventListener('click', e => { if (!$('ed-pick').checked) return; e.preventDefault(); e.stopPropagation(); show(e.target); }, true);
}

init();
