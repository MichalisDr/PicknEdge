// My Team gallery markup: one button per team, five portrait circles, the soft-capped credits bar and the filled-slot counts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryHtml, teamSlotHtml } from '../../site/fantasy/my-team/gallery-view.js';
import { defaultTeams, emptyTeam } from '../../site/core/team-model.js';

const players = { a: { name: 'A "Ace" <One>', portrait: 'assets/players/a.webp' }, b: { name: 'No Photo' } };
const lookups = { playerOf: id => players[id] ?? null, crOf: id => ({ a: 10.5, b: 4, six: 3, coach: 20 })[id] ?? null };
const circles = html => html.match(/data-part="fantasy\.my-team\.slot-portrait"/g).length;

test('two empty default teams: two buttons, five empty circles each, nothing used', () => {
  const html = galleryHtml(defaultTeams(), lookups);
  assert.equal(html.match(/<button type="button" data-part="fantasy\.my-team\.team-slot" data-team-slot="[01]"/g).length, 2);
  assert.equal(circles(html), 10);
  assert.ok(!html.includes('data-filled') && !html.includes('<img'));
  assert.ok(html.includes('0.0 / 115.6') && html.includes('0.0 / 100<') && html.includes('data-over="false"') && html.includes('style="width:0%"'));
  assert.equal(html.match(/0\/5 starters · 0\/5 bench/g).length, 2);
});

test('filled slots: portrait, name escaped, a circle without an image when there is no portrait; the coach counts nowhere', () => {
  const team = { ...emptyTeam('Mine & <co>', '2-2-1', '100'), starters: ['a', 'b', null, null, null], bench: ['six', null, null, null, null, 'coach'] };
  const html = teamSlotHtml(team, 0, lookups);
  assert.equal(circles(html), 5);
  assert.equal(html.match(/data-filled/g).length, 2);
  assert.equal(html.match(/<img /g).length, 1);
  assert.ok(html.includes('title="A &quot;Ace&quot; &lt;One&gt;"') && html.includes('Mine &amp; &lt;co&gt;'));
  assert.ok(html.includes('17.5 / 100<') && html.includes('style="width:17.5%"'));
  assert.ok(html.includes('2/5 starters · 1/5 bench'));
});

test('over the cap: marked, the bar stays full, and the label says by how much', () => {
  const team = { ...emptyTeam('T', '2-2-1', '10'), starters: ['a', 'b', null, null, null] };
  const html = teamSlotHtml(team, 1, lookups);
  assert.ok(html.includes('data-over="true"') && html.includes('style="width:100%"') && html.includes('14.5 / 10<'));
  assert.match(html, /aria-label="T, formation 2-2-1, 14\.5 of 10 credits used, 4\.5 over the cap, 2 of 5 starters, 0 of 5 bench"/);
});
