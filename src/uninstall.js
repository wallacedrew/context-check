'use strict';

const {
  resolveSettingsPath,
  loadSettings,
  isOurStatusLine,
  hasConflictingStatusLine,
  backupPathFor,
  writeSettings,
  writeBackup,
  withoutStatusLine,
} = require('./settings');
const { makeReporter } = require('./reporter');

const report = makeReporter('context-check uninstall:');

async function run(args) {
  const settingsPath = resolveSettingsPath(args);
  const force = args.includes('--force');

  const loadResult = await loadSettings(settingsPath);
  if (loadResult.error) {
    report(loadResult.error);
    process.exitCode = 1;
    return;
  }

  const { settings, existed } = loadResult;

  if (!existed) {
    report(`${settingsPath} does not exist; nothing to do`);
    return;
  }

  if (settings.statusLine == null) {
    report(`no statusLine configured in ${settingsPath}; nothing to do`);
    return;
  }

  if (hasConflictingStatusLine(settings) && !force) {
    report(conflictMessage(settingsPath, settings.statusLine));
    process.exitCode = 1;
    return;
  }

  await writeBackup(settingsPath, settings);
  await writeSettings(settingsPath, withoutStatusLine(settings));

  report(successMessage(settingsPath, isOurStatusLine(settings)));
}

function conflictMessage(settingsPath, currentStatusLine) {
  return `${settingsPath} has a different statusLine.\n` +
    `  current: ${JSON.stringify(currentStatusLine)}\n` +
    `  rerun with --force to remove it anyway`;
}

function successMessage(settingsPath, removedOurs) {
  const tail = removedOurs
    ? `  remember to also: npm uninstall -g context-check`
    : `  removed your custom statusLine (forced); restore from .bak if this was a mistake`;
  return `removed statusLine from ${settingsPath}.\n` +
    `  backup: ${backupPathFor(settingsPath)}\n` +
    tail;
}

module.exports = { run };
