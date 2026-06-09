'use strict';

const SessionState = require('./session-state');

const STDIN_TIMEOUT_MS = 200;

// Every failure path must degrade to a single line and exit 0 — this runs
// in a statusline and must NEVER break the prompt.
async function main() {
  const cliArgs = process.argv.slice(2);
  const lineMode = cliArgs.includes('--line');
  const demoMode = cliArgs.includes('--demo');

  if (demoMode) {
    renderOrReport(SessionState.demo(), lineMode);
    return;
  }

  const rawStdin = await loadStdinOrAdvise();
  if (rawStdin === null) return;

  const input = parseInputOrReport(rawStdin);
  if (input === null) return;

  const state = buildStateOrReport(input);
  if (state === null) return;

  renderOrReport(state, lineMode);
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

function parseInputOrReport(rawStdin) {
  try { return JSON.parse(rawStdin); }
  catch (_) { reportError('invalid JSON on stdin'); return null; }
}

function buildStateOrReport(input) {
  try { return SessionState.fromInput(input); }
  catch (_) { reportError('could not read session state'); return null; }
}

function renderOrReport(state, lineMode) {
  try { process.stdout.write(state.render(lineMode)); }
  catch (_) { reportError('render error'); }
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
