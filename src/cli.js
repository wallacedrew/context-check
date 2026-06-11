'use strict';

const SessionState = require('./session-state');
const SessionStateRenderer = require('./session-state-renderer');
const { makeReporter } = require('./reporter');
const { loadStdinOrAdvise } = require('./stdin-reader');

const { info } = makeReporter('context-check:');

const SUBCOMMANDS = {
  install: './install',
  uninstall: './uninstall',
};

// Every failure path must degrade to a single line and exit 0 — this runs
// in a statusline and must NEVER break the prompt.
async function main() {
  const cliArgs = process.argv.slice(2);

  const subcommandModule = SUBCOMMANDS[cliArgs[0]];
  if (subcommandModule) {
    await require(subcommandModule).run(cliArgs.slice(1));
    return;
  }

  const lineMode = cliArgs.includes('--line');
  const demoMode = cliArgs.includes('--demo');
  const withDir = cliArgs.includes('--with-dir');

  if (demoMode) {
    renderState(SessionState.demo({ withDir }), lineMode);
    return;
  }

  const rawStdin = await loadStdinOrAdvise();
  if (rawStdin === null) return;

  const input = tryOrReport(() => JSON.parse(rawStdin), 'invalid JSON on stdin');
  if (input === null) return;

  const state = tryOrReport(() => SessionState.fromInput(input, { withDir }), 'could not read session state');
  if (state === null) return;

  renderState(state, lineMode);
}

function renderState(state, lineMode) {
  tryOrReport(() => process.stdout.write(new SessionStateRenderer(state).render(lineMode)), 'render error');
}

function tryOrReport(action, errorMessage) {
  try { return action(); }
  catch (_) { info(errorMessage); return null; }
}

module.exports = { main };
