// Minimal CSV reader for data/clean (RFC 4180 quoting). Empty cell -> null; columns not listed as text -> Number.
const TEXT = new Set(['season', 'date_utc', 'team', 'opp', 'player_id', 'player', 'dorsal', 'team_name', 'poss_src', 'action', 'zone_feed', 'clock', 'position_feed', 'position_override', 'position', 'zone']);

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] === '' ? null : TEXT.has(h) ? r[i] : Number(r[i])])));
}
