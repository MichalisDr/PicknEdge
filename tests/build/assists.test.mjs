// Assist attribution, ported from the old site's tests (same fixtures). Run: node --test tests/build
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { linkAssists } from '../../scripts/build/assists.mjs';

const load = f => JSON.parse(readFileSync(new URL('../fixtures/' + f, import.meta.url), 'utf8'));
const pbp10 = load('game10-pbp.json'), pts10 = load('game10-points.json'), box10 = load('game10-box.json');
const as10 = { PAR: box10.Stats[0].totr.Assistances, MIL: box10.Stats[1].totr.Assistances };
const cases = load('assist-cases.json');
const caseOf = name => {
  const k = cases.find(x => x.name.includes(name)), count = {};
  k.plays.filter(e => e.PLAYTYPE.trim() === 'AS').forEach(e => { const t = e.CODETEAM.trim(); count[t] = (count[t] || 0) + 1; });
  const [h, a] = k.teams;
  return { k, pbp: { [k.quarter]: k.plays }, points: k.points, as: { [h]: count[h] || 0, [a]: count[a] || 0 } };
};
const link = x => linkAssists(x.pbp, x.points, x.as);

test('game 10: AS plays attach to made FGs through NUM_ANOT = NUMBEROFPLAY; free-throw assists are not field-goal assists', () => {
  const r = linkAssists(pbp10, pts10.Rows, as10);
  assert.ok(r.ok.has('PAR') && r.ok.has('MIL'));
  assert.equal(r.set.size, 36);                                    // 38 AS in the feed, 2 follow a made free throw
  const makes = new Map(pts10.Rows.filter(x => /FGM/.test(x.ID_ACTION)).map(x => [x.NUM_ANOT, x]));
  for (const n of r.set) assert.ok(makes.has(n), `assisted play ${n} is a made FG`);
  assert.equal(makes.get(36).ID_PLAYER.trim(), 'P011205');        // Hall 3FGM #36 is assisted by Wright AS #37
  assert.ok(r.set.has(36));
});

test('an AS that cannot be placed, or a box-score mismatch, makes the team-game unknown, never unassisted', () => {
  const broken = JSON.parse(JSON.stringify(pbp10)), q = broken.FirstQuarter;
  const as = q.find(e => e.PLAYTYPE === 'AS' && e.CODETEAM.trim() === 'MIL');
  as.MARKERTIME = '00:01'; q.forEach(e => { if (e.NUMBEROFPLAY === as.NUMBEROFPLAY - 1) e.PLAYTYPE = '2FGA'; });
  const r = linkAssists(broken, pts10.Rows, as10);
  assert.ok(r === null || !r.ok.has('MIL'));
  const short = linkAssists(pbp10, pts10.Rows, { ...as10, MIL: as10.MIL + 1 });
  assert.ok(!short.ok.has('MIL') && short.ok.has('PAR'));
});

test('game 17: a renumbered FG sits between the rebound and its AS; array order, not play number, gives the link', () => {
  const x = caseOf('game 17'), r = link(x);
  assert.ok(r.ok.has('ULK') && r.ok.has('MUN'));
  assert.deepEqual([...r.set].sort((a, b) => a - b), [18, 21, 78]);
  const sorted = { [x.k.quarter]: [...x.k.plays].sort((a, b) => a.NUMBEROFPLAY - b.NUMBEROFPLAY) };
  assert.ok(!link({ ...x, pbp: sorted }).set.has(78));             // sorting by number loses the link
});

test('games 1, 23, 44: assists of a free-throw trip count for the team but never mark a field goal', () => {
  for (const name of ['game 1)', 'game 23)', 'game 44)']) {
    const x = caseOf(name), r = link(x);
    assert.ok(r.ok.has(x.k.plays.find(e => e.PLAYTYPE.trim() === 'AS').CODETEAM.trim()), name);
    assert.equal(r.set.size, 0, name);
  }
  const x = caseOf('game 23'); x.k.plays.filter(e => /^FT/.test(e.PLAYTYPE.trim())).forEach(e => { e.MARKERTIME = '00:00'; });
  assert.ok(!link(x).ok.has('OLY'));                               // a different FT clock is not a trip: unknown
  const y = caseOf('game 44'); y.k.plays.find(e => e.PLAYTYPE.trim() === 'AS').MARKERTIME = '02:20';
  assert.ok(!link(y).ok.has('BAR'));
});

test('game 53: an AS stamped 8 s after its FG still belongs to the FG right before it; one AS per FG', () => {
  const x = caseOf('game 53'), r = link(x);
  assert.ok(r.ok.has('ASV') && r.ok.has('MAD'));
  assert.deepEqual([...r.set].sort((a, b) => a - b), [164, 167, 169]);
  const dup = caseOf('game 53'), i = dup.k.plays.findIndex(e => e.PLAYTYPE.trim() === 'AS');
  dup.k.plays.splice(i + 1, 0, { ...dup.k.plays[i], NUMBEROFPLAY: 999 }); dup.as.MAD++;
  assert.ok(!link(dup).ok.has('MAD'));                             // a second AS cannot reuse the same FG
});
