'use strict';

const { info } = require('./cli-reporter');

const STDIN_TIMEOUT_MS = 200;

async function loadStdinOrAdvise() {
  const rawStdin = await readStdinOrNull();
  if (rawStdin !== null && rawStdin !== '') return rawStdin;
  if (process.stdin.isTTY) {
    process.stdout.write(usageHint());
  } else {
    info('no input on stdin');
  }
  return null;
}

async function readStdinOrNull() {
  try { return await readStdin(STDIN_TIMEOUT_MS); }
  catch (_) { return null; }
}

// stdin reader must time out (~200ms) so the statusline never hangs.
function readStdin(timeoutMs) {
  if (process.stdin.isTTY) return Promise.resolve(null);
  return collectStdinWithTimeout(timeoutMs);
}

function collectStdinWithTimeout(timeoutMs) {
  return new Promise((resolve) => {
    let accumulated = '';
    let hasResolved = false;
    const finish = (result) => {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };
    const finishWithAccumulated = () => finish(accumulated || null);
    const timeoutHandle = setTimeout(finishWithAccumulated, timeoutMs);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { accumulated += chunk; });
    process.stdin.on('end', finishWithAccumulated);
    process.stdin.on('error', () => finish(null));
  });
}

function usageHint() {
  return [
    'context-check — pipe a Claude Code session JSON to stdin, or run with --demo',
    'statusline setup: { "statusLine": { "type": "command", "command": "context-check --line" } }',
  ].join('\n') + '\n';
}

module.exports = { loadStdinOrAdvise };
