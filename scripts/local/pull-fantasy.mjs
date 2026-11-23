// Pull the Fantasy credits from YOUR computer, with a token copied from the browser (the token expires after some days and cannot be renewed by a script).
// Usage:  npm run fantasy:pull        (or: node scripts/local/pull-fantasy.mjs [--season E2026])
//   Token: the environment variable FANTAKING_TOKEN if set, otherwise it is asked on the terminal with hidden input (with or without "Bearer ").
//   Get it in the browser: Fantasy site, DevTools, Network tab, any request to fantaking-api.dunkest.com, request header `authorization`.
// Flow: working tree clean and branch main -> git pull --rebase -> the same pull as the workflow (scripts/fetch/fantasy.mjs) ->
//       commit ONLY the new files under data/raw/<season>/fantasy -> push -> start the "Update data" workflow (gh), which rebuilds site/data.
// The token is never printed, logged, written to a file or put in a commit; site/data is only ever written by the workflow.
// Exit codes: 0 = done / nothing new, 1 = stopped (message says why), 2 = the Fantasy API shape changed.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pull, bareToken, mask, ShapeError } from '../fetch/fantasy.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRANCH = 'main', WORKFLOW = 'update-data.yml';

/** Run a command in the repo, no shell. Returns { status, stdout } (status null when the program does not exist). */
export const realExec = (cmd, args, cwd = repoRoot) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { status: r.error ? null : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
};

/** Read one line from the terminal without echoing it. The prompt goes to stderr. */
export function askHidden(prompt, { input = process.stdin, output = process.stderr } = {}) {
  return new Promise((resolve, reject) => {
    output.write(prompt);
    let buf = '';
    const raw = !!input.isTTY;
    if (raw) input.setRawMode(true);
    input.resume(); input.setEncoding('utf8');
    const finish = (fn, v) => { input.removeListener('data', onData); if (raw) input.setRawMode(false); input.pause(); output.write('\n'); fn(v); };
    const onData = chunk => {
      for (const ch of String(chunk)) {
        if (ch === '\r' || ch === '\n') return finish(resolve, buf.replace(/\x1b\[[0-9;]*[~A-Za-z]/g, '').trim());   // drop bracketed-paste markers
        if (ch === '\x03') return finish(reject, new Error('cancelled'));
        if (ch === '\x7f' || ch === '\b') buf = buf.slice(0, -1); else buf += ch;
      }
    };
    input.on('data', onData);
  });
}

export async function main({
  argv = process.argv, env = process.env, root = repoRoot, exec = realExec, ask = askHidden,
  fetch: fetchFn, sleep: wait, gapMs, log = console.log, error = console.error,
} = {}) {
  const arg = (n, d) => { const i = argv.indexOf('--' + n); return i > 0 ? argv[i + 1] : d; };
  const season = arg('season', 'E2026'), rel = `data/raw/${season}/fantasy`;
  let token = env.FANTAKING_TOKEN;
  // every line goes through the mask: whatever happens, the token cannot reach the terminal
  const say = (f, m) => f(mask(m, token));
  const out = m => say(log, m), err = m => say(error, m);
  const git = (...a) => exec('git', a, root);
  const fail = (m, code = 1) => { err(m); return code; };

  // 1. the repository must be ready (checked first, so a token is not pasted for nothing)
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch.status !== 0) return fail('Stopped: this is not a git repository (or git is not installed).');
  if (branch.stdout.trim() !== BRANCH) return fail(`Stopped: you are on "${branch.stdout.trim()}". Switch to ${BRANCH} first (git switch ${BRANCH}).`);
  const dirty = git('status', '--porcelain', '--untracked-files=no');
  if (dirty.status !== 0) return fail('Stopped: could not read the git status.');
  if (dirty.stdout.trim()) return fail('Stopped: there are uncommitted changes. Commit or stash them first, then run this again.');
  const pulled = git('pull', '--rebase');
  if (pulled.status !== 0) return fail('Stopped: git pull --rebase failed. Fix that first (nothing was fetched from Fantasy).');

  // 2. the token
  if (!bareToken(token)) {
    try { token = await ask('Paste the Fantasy token (hidden), then press Enter: '); }
    catch { return fail('Stopped: no token given.'); }
  }
  if (!bareToken(token)) return fail('Stopped: no token given.');

  // 3. the same pull as the workflow
  let r;
  try {
    r = await pull({ root: join(root, ...rel.split('/')), token, fetch: fetchFn, sleep: wait, gapMs, log: out, warn: () => {} });
  } catch (e) {
    if (e instanceof ShapeError) return fail(`FATAL: ${e.message}\nStopping: the Fantasy API response changed. Nothing was committed.`, 2);
    return fail(`Stopped: ${e.message}. Nothing was committed.`);
  }
  if (r.status === 'auth') return fail('Stopped: the Fantasy backend rejected the token (HTTP 401/403): it is expired or wrong. Copy a fresh one from the browser and run this again. Nothing was changed.');
  if (r.status !== 'ok') return fail('Stopped: no token.');
  out(`fantasy: ${r.written} new snapshot(s), ${r.unchanged} unchanged, ${r.matchdays} round(s) covered`);
  if (!r.written) { out('Nothing new from Fantasy: nothing to commit.'); return 0; }

  // 4. commit ONLY the new snapshots, push
  if (git('add', '--', rel).status !== 0) return fail('Stopped: git add failed.');
  const staged = git('diff', '--cached', '--name-only');
  const names = staged.stdout.split('\n').map(s => s.trim()).filter(Boolean);
  const outside = names.filter(n => !n.startsWith(rel + '/'));
  if (staged.status !== 0 || outside.length) { git('reset', '-q', '--', ...(names.length ? names : ['.'])); return fail(`Stopped: unexpected files were staged (${outside.slice(0, 3).join(', ') || 'unknown'}); nothing was committed.`); }
  if (!names.length) { out('Nothing new to commit.'); return 0; }
  if (git('commit', '-m', 'data: fantasy credits (local pull)').status !== 0) return fail('Stopped: git commit failed.');
  let push = git('push', 'origin', BRANCH);
  if (push.status !== 0) {                                         // the bot may have pushed in the meantime: one rebase and one more try
    if (git('pull', '--rebase').status === 0) push = git('push', 'origin', BRANCH);
  }
  if (push.status !== 0) return fail('The commit is made locally but the push failed. Run "git pull --rebase" and "git push" yourself.');
  out(`Pushed ${names.length} new file(s) under ${rel}.`);

  // 5. rebuild site/data with the workflow (generated files are only ever written there)
  const auth = exec('gh', ['auth', 'status'], root);
  if (auth.status === 0 && exec('gh', ['workflow', 'run', WORKFLOW, '--ref', BRANCH], root).status === 0) out(`Started the "Update data" workflow (${WORKFLOW}) on ${BRANCH}.`);
  else out('Now run the "Update data" workflow from the Actions tab on GitHub (it rebuilds site/data from the new snapshots).');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await main());
