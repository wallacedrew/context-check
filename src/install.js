'use strict';

const { mkdir } = require('node:fs/promises');
const path = require('node:path');

const {
  resolveSettingsPath,
  loadSettings,
  isAlreadyConfigured,
  hasConflictingStatusLine,
  backupPathFor,
  writeSettings,
  writeBackup,
  withStatusLine,
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
    report(conflictMessage(settingsPath, settings.statusLine));
    process.exitCode = 1;
    return;
  }

  if (existed) {
    await writeBackup(settingsPath, settings);
  } else {
    await mkdir(path.dirname(settingsPath), { recursive: true });
  }

  await writeSettings(settingsPath, withStatusLine(settings, options));

  report(successMessage(settingsPath, existed));
}

function conflictMessage(settingsPath, currentStatusLine) {
  return `${settingsPath} already has a different statusLine.\n` +
    `  current: ${JSON.stringify(currentStatusLine)}\n` +
    `  rerun with --force to overwrite`;
}

function successMessage(settingsPath, existed) {
  const backupLine = existed ? `  backup: ${backupPathFor(settingsPath)}\n` : '';
  return `wrote statusLine to ${settingsPath}.\n` +
    backupLine +
    `  reload Claude Code to see the gauge`;
}

module.exports = { run };
