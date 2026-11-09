// Hand-checked mini game for the play-by-play analysis. Run: node --test tests/build
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, splitPeriods } from '../../scripts/build/pbp.mjs';

const ev = (n, team, type, player, time) => ({ NUMBEROFPLAY: n, CODETEAM: team, PLAYTYPE: type, PLAYER_ID: player, MARKERTIME: time, MINUTE: 1 });
const pbp = {
  FirstQuarter: [
    ev(1, 'AAA', '2FGA', 'A1', '09:50'),   // A possession 1, A shot attempt
    ev(2, 'BBB', 'D', 'B1', '09:45'),      // B possession 1 (defensive rebound)
    ev(3, 'BBB', '3FGM', 'B1', '09:30'),   // same B possession, B shot attempt
    ev(4, 'AAA', 'TO', 'A1', '09:10'),     // A possession 2, A turnover
    ev(5, 'BBB', '2FGA', 'B1', '08:50'),   // B possession 2, B shot attempt
    ev(6, 'AAA', 'D', 'A1', '08:45'),      // A possession 3 (defensive rebound)
  ],
  SecondQuarter: [], ThirdQuarter: [], ForthQuarter: [], ExtraTime: [],
};
const box = { AAA: [{ id: 'A1', starter: 1, sec: 2400 }], BBB: [{ id: 'B1', starter: 1, sec: 2400 }] };

test('possessions, shot attempts, turnovers and rebounds of a mini game', () => {
  const r = analyze(pbp, ['AAA', 'BBB'], box);
  assert.equal(r.teams.AAA.poss, 3); assert.equal(r.teams.BBB.poss, 2);
  assert.equal(r.teams.AAA.sa, 1); assert.equal(r.teams.BBB.sa, 2);
  assert.equal(r.teams.AAA.tov, 1);
  assert.deepEqual([r.teams.AAA.dreb, r.teams.BBB.dreb, r.teams.AAA.oreb], [1, 1, 0]);
});

test('on-court components of the two players', () => {
  const { A1, B1 } = analyze(pbp, ['AAA', 'BBB'], box).players;
  assert.deepEqual([A1.sa, A1.team_sa_on, A1.team_tov_on, A1.poss_off_on, A1.poss_def_on, A1.team_dreb_on, A1.opp_dreb_on], [1, 1, 1, 3, 2, 1, 1]);
  assert.deepEqual([A1.team_fgm_on, A1.opp_a2_on, B1.team_fgm_on, B1.opp_a2_on], [0, 1, 1, 1]);   // B made 1; B attempted one two (A1 on court), A attempted one (B1 on court)
  assert.deepEqual([B1.sa, B1.team_sa_on, B1.poss_off_on, B1.poss_def_on, B1.team_dreb_on, B1.opp_dreb_on], [2, 2, 2, 3, 1, 1]);
});

test('overtimes are split by minute; end-of-period markers stay with the period they close', () => {
  const e = (m, type) => ({ MINUTE: m, PLAYTYPE: type, CODETEAM: '', MARKERTIME: '' });
  const p = splitPeriods({ FirstQuarter: [], SecondQuarter: [], ThirdQuarter: [], ForthQuarter: [], ExtraTime: [e(41, 'BP'), e(45, '2FGA'), e(46, 'EP'), e(46, 'BP'), e(48, '2FGA'), e(51, 'EG')] });
  assert.equal(p.length, 6);
  assert.deepEqual(p.slice(4).map(x => [x.start, x.len, x.events.length]), [[2400, 300, 3], [2700, 300, 3]]);
});
