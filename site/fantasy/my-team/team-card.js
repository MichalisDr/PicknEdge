/* The team card of My Team, as a dialog: the same dialog, header, chips and icon buttons as the player and team cards (their classes and data-parts),
   plus the name editor and the credits meter. It is drawn once and then updated in place, so a click that follows an edit of the name or the cap is
   never lost to a redraw. The state is the page's: get() returns the undo entry { team, history } of this team, set(entry) keeps and saves it. */
import { esc } from '../../core/html.js';
import { icon } from '../../core/icons.js';
import { courtHtml, benchHtml } from './court-view.js';
import { mountPicker, slotRequest } from './picker.js';
import { FORMATIONS, change, undo, clearPlayers, credits, idsOf, setCap, setFormation, setName, setPlayer } from '../../core/team-model.js';

/** Icons to load (core/icons.js loadIcons) before the card is opened. */
export const CARD_ICONS = ['pencil', 'check', 'undo', 'reset'];

const CARD = 'fantasy.player-card.';
const part = key => `data-part="fantasy.my-team.${key}"`;

const nameButton = (attrs, iconName, label) => `<button ${attrs} ${part('name-button')} aria-label="${label}" title="${label}">${icon(iconName)}</button>`;
const toolButton = (action, iconName, label) => `<button type="button" data-part="${CARD}view-button" data-action="${action}"><span data-part="${CARD}view-icon" aria-hidden="true">${icon(iconName)}</span><span>${label}</span></button>`;

/** The card without its values (update() fills them in). The empty close slot takes the dialog's close button. */
export function cardHtml() {
  return `<header class="fw-identity" data-part="${CARD}header">
    <div ${part('card-identity')}>
      <div ${part('name-editor')} data-name-view><h2></h2>${nameButton('type="button" data-rename', 'pencil', 'Rename the team')}</div>
      <form ${part('name-editor')} data-name-form hidden><input ${part('name-input')} data-name-input aria-label="Team name" autocomplete="off">${nameButton('type="submit"', 'check', 'Save the name')}</form>
      <span data-part="${CARD}cr-box"><span data-part="${CARD}cr-box-label">CR</span><span data-part="${CARD}cr-box-value" data-used></span></span>
    </div>
    <div data-part="${CARD}header-actions"><span data-close-slot></span></div>
  </header>
  <div class="fw-card-controls">
    <div role="group" aria-label="Formation" data-part="${CARD}window-buttons">${FORMATIONS.map(f => `<button type="button" data-formation="${f}">${f}</button>`).join('')}</div>
    <div role="group" aria-label="Team actions" data-part="${CARD}view-buttons">${toolButton('undo', 'undo', 'Undo')}${toolButton('reset', 'reset', 'Reset')}</div>
  </div>
  <div ${part('cap-meter')} data-meter>
    <span ${part('cap-label')}>CREDITS</span>
    <span ${part('cap-figures')}><span data-used></span><span aria-hidden="true">/</span><input ${part('cap-input')} data-cap inputmode="decimal" aria-label="Credit cap" autocomplete="off"></span>
    <span ${part('credits-bar')} aria-hidden="true"><span ${part('credits-fill')} data-fill></span></span>
    <span ${part('cap-status')} data-status role="status"></span>
  </div>
  <div ${part('card-body')} data-card-body><div ${part('card-main')} data-body></div></div>`;
}

/** The values the card shows for a team: credits used, the bar and what is left or over. */
export function meterValues(team, crOf) {
  const c = credits(team, crOf);
  return {
    used: c.used.toFixed(1),
    over: c.isOver,
    percent: c.cap === null ? 0 : Math.min(100, (c.used / c.cap) * 100),
    status: (c.isOver ? `${c.over.toFixed(1)} over the cap` : `${(c.left ?? 0).toFixed(1)} left`) + (c.missing ? ` · ${c.missing} without CR` : ''),   // they count as 0
  };
}

let dialog = null;

/** Open the card. state: { get, set, crOf, playerOf, pool } (playerOf: the court card's data, court-view.js; pool: the players of the picker;
    openPlayer(id, trigger): the existing player card, on top of this one); onClose runs after the person closes it (not when the route changes under it). */
export function open({ get, set, crOf, playerOf, pool, openPlayer }, onClose) {
  close();
  const previous = document.activeElement;
  dialog = document.createElement('dialog');
  dialog.className = 'fw-dialog';
  dialog.innerHTML = '<button type="button" class="fw-close" aria-label="Close card">×</button><div class="fw-card"></div>';
  const root = dialog.querySelector('.fw-card'), closeButton = dialog.querySelector('.fw-close');
  root.innerHTML = cardHtml();
  root.querySelector('[data-close-slot]').replaceWith(closeButton);
  const $ = s => root.querySelector(s);
  const view = $('[data-name-view]'), form = $('[data-name-form]'), nameInput = $('[data-name-input]'), capInput = $('[data-cap]');

  let drawn = '';   // what the court and the bench show now
  function drawBody(team) {
    const key = `${team.formation}|${team.starters.join()}|${team.bench.join()}`;
    if (key === drawn) return;
    closePicker(false);   // the slot it was opened for may be gone or have another position
    drawn = key;
    $('[data-body]').innerHTML = courtHtml(team, playerOf) + benchHtml(team, playerOf);
  }

  /* The picker, for one empty slot at a time. Picking is an edit like any other, so Undo takes it back. */
  let picker = null;   // { el, slot: 'starters:2' }
  const slotElement = slot => root.querySelector(`[data-slot="${slot}"]`);
  function closePicker(giveFocusBack) {
    if (!picker) return;
    const { el, slot } = picker;
    picker = null;
    el.remove();
    delete dialog.dataset.picker;
    const trigger = slotElement(slot);
    trigger?.removeAttribute('data-active');
    if (giveFocusBack) trigger?.focus();
  }
  function openPicker(slot) {
    closePicker(false);
    const [area, index] = slot.split(':'), where = { area, index: Number(index) }, { team } = get();
    dialog.dataset.picker = '';   // wide screens: the card grows and the panel stands beside the court
    slotElement(slot).setAttribute('data-active', '');
    const el = mountPicker($('[data-card-body]'), {
      request: slotRequest(team, where),
      pool: pool(),
      taken: idsOf(team),
      onPick: id => {
        closePicker(false);
        edit(t => setPlayer(t, where.area, where.index, id));
        const filled = slotElement(slot);   // the focus goes to the card that took the slot's place
        filled?.querySelector('[data-open-player]')?.focus();
      },
      onClose: () => closePicker(true),
    });
    picker = { el, slot };
  }

  function update() {
    const { team, history } = get(), m = meterValues(team, crOf);
    dialog.setAttribute('aria-label', team.name);
    const title = view.querySelector('h2');
    title.textContent = title.title = team.name;
    root.querySelectorAll('[data-used]').forEach(el => { el.textContent = m.used; });
    root.querySelectorAll('[data-formation]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.formation === team.formation)));
    /* aria-disabled, not disabled: the button keeps the keyboard focus when there is nothing left to do. */
    $('[data-action="undo"]').setAttribute('aria-disabled', String(!history.length));
    $('[data-action="reset"]').setAttribute('aria-disabled', String(!idsOf(team).length));
    capInput.value = team.capText;
    $('[data-meter]').dataset.over = m.over;
    $('[data-fill]').style.width = m.percent + '%';
    $('[data-status]').textContent = m.status;
    drawBody(team);
  }
  const apply = next => { if (next !== get()) set(next); update(); };
  const edit = fn => apply(change(get(), fn(get().team)));

  const rename = on => { view.hidden = on; form.hidden = !on; };
  $('[data-rename]').onclick = () => { nameInput.value = get().team.name; rename(true); nameInput.select(); };
  const endRename = () => { rename(false); $('[data-rename]').focus(); };
  form.onsubmit = e => { e.preventDefault(); edit(team => setName(team, nameInput.value)); endRename(); };
  nameInput.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endRename(); } };   // Esc leaves the editor, not the card

  capInput.onchange = () => edit(team => setCap(team, capInput.value));   // a text that is not a number goes back to the old cap
  capInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); capInput.blur(); capInput.focus(); } };
  root.querySelectorAll('[data-formation]').forEach(b => { b.onclick = () => edit(team => setFormation(team, b.dataset.formation)); });
  $('[data-action="undo"]').onclick = () => apply(undo(get()));
  $('[data-action="reset"]').onclick = () => edit(clearPlayers);
  /* An empty slot (itself a button) opens the picker. On a filled one, the card opens the existing player card and the small button empties the slot;
     another player is then picked from the empty slot. */
  $('[data-body]').onclick = e => {
    const empty = e.target.closest('button[data-slot]');
    if (empty) return openPicker(empty.dataset.slot);
    const button = e.target.closest('[data-open-player], [data-remove]');
    if (!button) return;
    const slot = button.closest('[data-slot]').dataset.slot, [area, index] = slot.split(':');
    closePicker(false);
    if (button.hasAttribute('data-remove')) {
      edit(team => setPlayer(team, area, Number(index), null));
      slotElement(slot)?.focus();   // now the empty slot: Enter picks a replacement, Undo brings the player back
    } else openPlayer(get().team[area][Number(index)], button);
  };

  const done = () => { close(); previous?.focus?.(); onClose?.(); };
  /* Esc closes the picker first, then the card. Handled on the key, so the dialog never gets its cancel while the picker is open. */
  dialog.onkeydown = e => { if (e.key === 'Escape' && picker) { e.preventDefault(); closePicker(true); } };
  closeButton.onclick = done;
  dialog.oncancel = e => { e.preventDefault(); if (picker) closePicker(true); else done(); };
  dialog.onclick = e => { if (e.target === dialog) done(); };
  update();
  document.body.append(dialog);
  dialog.showModal();
  closeButton.focus();   // as on the player card, where Close is the first control; otherwise the dialog would start on the pencil
}

export function close() { if (dialog) { dialog.close(); dialog.remove(); dialog = null; } }
globalThis.window?.addEventListener('hashchange', close);
