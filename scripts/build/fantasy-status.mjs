// Are the Fantasy credits behind the games? One clear message (a GitHub warning annotation + one line in the job summary), never a failure.
// Usage (update-data workflow, after the clean tables are built): node scripts/build/fantasy-status.mjs
// The credits come from a private backend with a token that expires after some days and cannot be renewed by a script, so the games can be a
// round or more ahead of the credits. The build tolerates that (cr / crSeries / valueSeries stop at the last round with credits); this only makes it visible.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';
import { readFantasy } from './fantasy.mjs';

/** creditsRound / gamesRound: last round with credits / with games. Returns the one-line message only when the credits are behind the games,
 *  null otherwise (how the workflow's own pull ended does not matter: the credits normally come from the local pull). */
export function creditsMessage({ creditsRound, gamesRound }) {
  return gamesRound > creditsRound ? `Fantasy credits are at round ${creditsRound}, games at round ${gamesRound}: run the local pull (npm run fantasy:pull)` : null;
}

/** Print the annotation and write the summary line. Returns the message (or null). */
export function report({ creditsRound, gamesRound, env = process.env, log = console.log, append = appendFileSync }) {
  const message = creditsMessage({ creditsRound, gamesRound });
  if (!message) return null;
  log(env.GITHUB_ACTIONS ? `::warning title=Fantasy credits::${message}` : `WARNING: ${message}`);
  if (env.GITHUB_STEP_SUMMARY) append(env.GITHUB_STEP_SUMMARY, `### Fantasy credits\n\n${message}\n`);
  return message;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const teams = parseCsv(readFileSync(join(repo, 'data', 'clean', 'team_games.csv'), 'utf8'));
  const gamesRound = Math.max(0, ...teams.map(t => Number(t.round)));
  const dir = join(repo, 'data', 'raw', teams[0]?.season || 'E2026', 'fantasy');
  const creditsRound = existsSync(dir) ? (readFantasy(dir)?.lastRound ?? 0) : 0;
  report({ creditsRound, gamesRound });
}
