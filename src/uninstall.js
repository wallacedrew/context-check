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

const { info, fail } = makeReporter('context-check uninstall:');

async function run(args) {
  const settingsPath = resolveSettingsPath(args);
  const force = args.includes('--force');

  const loadResult = await loadSettings(settingsPath);
  if (loadResult.error) return fail(loadResult.error);

  const { settings, existed } = loadResult;

  if (!existed) return info(`${settingsPath} does not exist; nothing to do`);
  if (settings.statusLine == null) return info(`no statusLine configured in ${settingsPath}; nothing to do`);
  if (hasConflictingStatusLine(settings) && !force) return fail(conflictMessage(settingsPath, settings.statusLine));

  await writeBackup(settingsPath, settings);
  await writeSettings(settingsPath, withoutStatusLine(settings));

  info(successMessage(settingsPath, isOurStatusLine(settings)));
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
