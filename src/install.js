'use strict';

const { writeFile, mkdir } = require('node:fs/promises');
const path = require('node:path');

const {
  statusLineFor,
  resolveSettingsPath,
  loadSettings,
  isAlreadyConfigured,
  hasConflictingStatusLine,
  backupPathFor,
} = require('./settings');
const { makeReporter } = require('./reporter');

const report = makeReporter('context-check install:');

async function run(args) {
  const settingsPath = resolveSettingsPath(args);
  const force = args.includes('--force');
  const options = { withDir: args.includes('--with-dir') };

  const loadResult = await loadSettings(settingsPath);
  if (loadResult.error) {
    report(loadResult.error);
    process.exitCode = 1;
    return;
  }

  const { settings, existed } = loadResult;

  if (isAlreadyConfigured(settings, options)) {
    report(`statusLine already configured in ${settingsPath}; nothing to do`);
    return;
  }

  if (hasConflictingStatusLine(settings) && !force) {
    report(
      `${settingsPath} already has a different statusLine.\n` +
      `  current: ${JSON.stringify(settings.statusLine)}\n` +
      `  rerun with --force to overwrite`
    );
    process.exitCode = 1;
    return;
  }

  if (existed) {
    await writeFile(backupPathFor(settingsPath), JSON.stringify(settings, null, 2) + '\n');
  } else {
    await mkdir(path.dirname(settingsPath), { recursive: true });
  }

  const next = { ...settings, statusLine: statusLineFor(options) };
  await writeFile(settingsPath, JSON.stringify(next, null, 2) + '\n');

  report(
    `wrote statusLine to ${settingsPath}.\n` +
    (existed ? `  backup: ${backupPathFor(settingsPath)}\n` : '') +
    `  reload Claude Code to see the gauge`
  );
}

module.exports = { run };
