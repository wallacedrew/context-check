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
const { makeReporter } = require('../shell/reporter');

const { info, fail } = makeReporter('context-check install:');

async function run(args) {
  const settingsPath = resolveSettingsPath(args);
  const force = args.includes('--force');
  const options = { withDir: args.includes('--with-dir') };

  const loadResult = await loadSettings(settingsPath);
  if (loadResult.error) return fail(loadResult.error);

  const { settings, existed } = loadResult;

  if (isAlreadyConfigured(settings, options)) return info(`statusLine already configured in ${settingsPath}; nothing to do`);
  if (hasConflictingStatusLine(settings) && !force) return fail(conflictMessage(settingsPath, settings.statusLine));

  await prepareSettingsTarget(settingsPath, settings, existed);
  await writeSettings(settingsPath, withStatusLine(settings, options));

  info(successMessage(settingsPath, existed));
}

async function prepareSettingsTarget(settingsPath, settings, existed) {
  if (existed) {
    await writeBackup(settingsPath, settings);
  } else {
    await mkdir(path.dirname(settingsPath), { recursive: true });
  }
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
