// My Team card: it is built from the player card's dialog parts, and the meter says what is left or how far over the soft cap the team is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadIcons } from '../../site/core/icons.js';
import { cardHtml, meterValues, CARD_ICONS } from '../../site/fantasy/my-team/team-card.js';
import { FORMATIONS, emptyTeam } from '../../site/core/team-model.js';

const site = rel => readFileSync(new URL('../../site/' + rel, import.meta.url), 'utf8');
await loadIcons(CARD_ICONS, async name => site(`assets/icons/${name}.svg`));

test('header, chips and icon buttons are the player card parts', () => {
  const html = cardHtml();
  for (const key of ['header', 'header-actions', 'cr-box', 'cr-box-label', 'cr-box-value', 'window-buttons', 'view-buttons', 'view-button', 'view-icon'])
    assert.ok(html.includes(`data-part="fantasy.player-card.${key}"`), key);
  assert.ok(html.includes('class="fw-card-controls"') && html.includes('data-close-slot'));
  assert.deepEqual([...html.matchAll(/data-formation="([\d-]+)"/g)].map(m => m[1]), FORMATIONS);
});

test('every button and field has an accessible name', () => {
  const html = cardHtml();
  for (const label of ['Rename the team', 'Save the name', 'Team name', 'Credit cap']) assert.ok(html.includes(`aria-label="${label}"`), label);
  assert.match(html, /<span>Undo<\/span>/);
  assert.match(html, /<span>Reset<\/span>/);
});

test('the dialog is the card dialog: same classes, backdrop click, Esc and focus return', () => {
  const src = site('fantasy/my-team/team-card.js');
  for (const piece of ["className = 'fw-dialog'", 'class="fw-close"', 'showModal()', 'dialog.oncancel', 'e.target === dialog', 'previous?.focus?.()', "addEventListener('hashchange', close)"])
    assert.ok(src.includes(piece), piece);
});

test('meter: what is left, then how far over; the bar stops at 100%', () => {
  const team = { ...emptyTeam('T', '2-2-1', '20'), starters: ['a', null, null, null, null] };
  assert.deepEqual(meterValues(team, () => 5), { used: '5.0', over: false, percent: 25, status: '15.0 left' });
  assert.deepEqual(meterValues(team, () => 20), { used: '20.0', over: false, percent: 100, status: '0.0 left' });
  assert.deepEqual(meterValues(team, () => 22.5), { used: '22.5', over: true, percent: 100, status: '2.5 over the cap' });
});
