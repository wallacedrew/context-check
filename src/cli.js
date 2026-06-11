'use strict';

const SessionState = require('./session-state');

const STDIN_TIMEOUT_MS = 200;

// Every failure path must degrade to a single line and exit 0 — this runs
// in a statusline and must NEVER break the prompt.
async function main() {
  const cliArgs = process.argv.slice(2);

  if (cliArgs[0] === 'install') {
    await require('./install').run(cliArgs.slice(1));
    return;
  }

  if (cliArgs[0] === 'uninstall') {
    await require('./uninstall').run(cliArgs.slice(1));
    return;
  }

  const lineMode = cliArgs.includes('--line');
  const demoMode = cliArgs.includes('--demo');
  const withDir = cliArgs.includes('--with-dir');

  if (demoMode) {
    const demoState = SessionState.demo({ withDir });
    tryOr(() => process.stdout.write(demoState.render(lineMode)), 'render error');
    return;
  }

  const rawStdin = await loadStdinOrAdvise();
  if (rawStdin === null) return;

  const input = tryOr(() => JSON.parse(rawStdin), 'invalid JSON on stdin');
  if (input === null) return;

  const state = tryOr(() => SessionState.fromInput(input, { withDir }), 'could not read session state');
  if (state === null) return;

  tryOr(() => process.stdout.write(state.render(lineMode)), 'render error');
}

async function loadStdinOrAdvise() {
  const rawStdin = await readStdinOrNull();
  if (rawStdin !== null && rawStdin !== '') return rawStdin;
  if (process.stdin.isTTY) {
    process.stdout.write(usageHint());
  } else {
    reportError('no input on stdin');
  }
  return null;
}

async function readStdinOrNull() {
  try { return await readStdin(STDIN_TIMEOUT_MS); }
  catch (_) { return null; }
}

function tryOr(action, errorMessage) {
  try { return action(); }
  catch (_) { reportError(errorMessage); return null; }
}

function reportError(message) {
  process.stdout.write(`context-check: ${message}\n`);
}

// stdin reader must time out (~200ms) so the statusline never hangs.
function readStdin(timeoutMs) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }
    let accumulated = '';
    let hasResolved = false;
    const finish = (result) => {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };
    const timeoutHandle = setTimeout(() => finish(accumulated || null), timeoutMs);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { accumulated += chunk; });
    process.stdin.on('end', () => finish(accumulated || null));
    process.stdin.on('error', () => finish(null));
  });
}

function usageHint() {
  return [
    'context-check — pipe a Claude Code session JSON to stdin, or run with --demo',
    'statusline setup: { "statusLine": { "type": "command", "command": "context-check --line" } }',
  ].join('\n') + '\n';
}

module.exports = { main };
