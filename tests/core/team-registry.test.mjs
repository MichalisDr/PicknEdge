// One team registry (site/assets/teams.js): public code, feed code, current name; checked against the roster snapshot so drift shows at the next fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { TEAMS } from '../../site/assets/teams.js';
import { teamCode, teamEntry, teamLabel } from '../../site/core/teams.js';

const snapshot = JSON.parse(gunzipSync(readFileSync(new URL('../../data/raw/E2026/roster.json.gz', import.meta.url))).toString('utf8'));
const logoIds = Object.fromEntries(TEAMS.map(t => [t.feed, t.id]));   // exactly what scripts/build/site-data.mjs derives
const ROSTER = { teams: {}, logoIds };

test('every registry team has the snapshot tvCode, name and a primary colour (the feed code is the key)', () => {
  assert.equal(TEAMS.length, 20); assert.equal(snapshot.clubs.length, 20);
  for (const c of snapshot.clubs) {
    const t = TEAMS.find(x => x.feed === c.code);
    assert.ok(t, c.code + ' is in the registry');
    assert.equal(t.code, c.tvCode, c.code + ' public code'); assert.equal(t.name, c.name, c.code + ' name');
    assert.match(c.primaryColor, /^#[0-9A-Fa-f]{6}$/, c.code + ' primaryColor in the snapshot');
  }
  assert.equal(new Set(TEAMS.map(t => t.code)).size, 20); assert.equal(new Set(TEAMS.map(t => t.feed)).size, 20);
});

test('the ten corrected names are the feed names', () => {
  const by = Object.fromEntries(TEAMS.map(t => [t.code, t.name]));
  assert.deepEqual({ PAO: by.PAO, BJK: by.BJK, FBT: by.FBT, KBA: by.KBA, MTA: by.MTA, MIL: by.MIL, CZV: by.CZV, HTA: by.HTA, VIR: by.VIR, DUB: by.DUB }, {
    PAO: 'Panathinaikos AKTOR Athens', BJK: 'Besiktas Fuzul Istanbul', FBT: 'Fenerbahce Tarfin Istanbul', KBA: 'Kosner Baskonia Vitoria-Gasteiz', MTA: 'Maccabi Rapyd Tel Aviv',
    MIL: 'Armani Olimpia Milan', CZV: 'Crvena Zvezda Meridianbet Belgrade', HTA: 'Hapoel IBI Tel Aviv', VIR: 'Virtus Bologna', DUB: 'Dubai Basketball' });
});

test('logoIds and the Fantasy-abbreviation map are derived from the registry and equal the two hand-written maps they replace', () => {
  const OLD_IDS = { IST: 'anadolu-efes-istanbul', ASV: 'asvel-lyon-villeurbanne', BAR: 'barcelona', BAS: 'baskonia', MUN: 'bayern-munich', BES: 'besiktas', DUB: 'dubai', ULK: 'fenerbahce-ulker', HTA: 'hapoel-tel-aviv', RED: 'kk-crvena-zvezda', TEL: 'maccabi-tel-aviv', MIL: 'milano', OLY: 'olympiacos', PAN: 'panathinaikos', PRS: 'paris-basketball', PAR: 'partizan', MAD: 'real-madrid', PAM: 'valencia', VIR: 'virtus-bologna', ZAL: 'zalgiris-kaunas' };
  const OLD_FANTASY = { ASV: 'ASV', BAR: 'BAR', BAY: 'MUN', BJK: 'BES', CZV: 'RED', DUB: 'DUB', EFS: 'IST', FBT: 'ULK', HTA: 'HTA', KBA: 'BAS', MIL: 'MIL', MTA: 'TEL', OLY: 'OLY', PAO: 'PAN', PAR: 'PAR', PBB: 'PRS', RMB: 'MAD', VBC: 'PAM', VIR: 'VIR', ZAL: 'ZAL' };
  assert.deepEqual(logoIds, OLD_IDS);
  assert.deepEqual(Object.fromEntries(TEAMS.map(t => [t.code, t.feed])), OLD_FANTASY);
});

test('the code helper never shows a data code: every data code of the roster shows its public code', () => {
  for (const t of TEAMS) {
    assert.equal(teamCode(ROSTER, t.feed), t.code); assert.equal(teamEntry(ROSTER, t.feed).id, t.id);
    assert.equal(teamLabel(ROSTER, t.feed), t.label);
  }
  for (const dataCode of ['PAN', 'MUN', 'IST', 'RED', 'ULK', 'MAD', 'TEL', 'PAM', 'BAS', 'PRS', 'BES']) assert.notEqual(teamCode(ROSTER, dataCode), dataCode, dataCode + ' is not shown as such');
});
