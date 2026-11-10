// Audit: our PIR (from the metric registry, the only place the formula lives) vs the official valuation per player-game.
import { byId, rowValue } from '../metrics/engine.mjs';

export function auditPir(playerRows) {
  const pir = byId('pir');
  const played = playerRows.filter(r => r.played);
  const bad = [];
  for (const r of played) {
    const ours = rowValue(pir, r);
    if (ours !== r.pir_official) bad.push({ game: r.game, player_id: r.player_id, ours, official: r.pir_official });
  }
  return { total: played.length, match: played.length - bad.length, bad };
}
