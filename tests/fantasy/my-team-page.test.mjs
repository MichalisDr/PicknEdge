// My Team: the route belongs to the Fantasy area, has the one link of the FEATURES sidebar group, and the page opens with the Players / Teams title.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageHtml } from '../../site/fantasy/my-team/team-page.js';

const shell = readFileSync(new URL('../../site/app/shell.js', import.meta.url), 'utf8');

test('the page title uses the parts of the Players / Teams title', () => {
  assert.match(pageHtml(), /^<section class="fantasy-stats fw-workbench mt-page"><div data-part="fantasy\.stat-table\.title-row"><h1 data-part="fantasy\.stat-table\.heading-title">My Team<\/h1>/);
});

test('fantasy/my-team is a route, mounted before the tables', () => {
  assert.match(shell, /const ROUTES = \[[^\]]*'fantasy\/my-team'/);
  assert.ok(shell.indexOf('return mountMyTeam(content)') > 0 && shell.indexOf('return mountMyTeam(content)') < shell.indexOf('return mountFantasyTables('));
});

test('the FEATURES group is Fantasy only and has exactly one link', () => {
  assert.match(shell, /const FEATURES = \{ fantasy: \[\['fantasy\/my-team', 'My Team'\]\] \};/);
  assert.ok(!/Compare|Matchup/.test(shell));
});
