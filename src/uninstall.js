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
    report(
      `${settingsPath} has a different statusLine.\n` +
      `  current: ${JSON.stringify(settings.statusLine)}\n` +
      `  rerun with --force to remove it anyway`
    );
    process.exitCode = 1;
    return;
  }

  await writeBackup(settingsPath, settings);
  await writeSettings(settingsPath, withoutStatusLine(settings));

  const removedOurs = isOurStatusLine(settings);
  report(
    `removed statusLine from ${settingsPath}.\n` +
    `  backup: ${backupPathFor(settingsPath)}\n` +
    (removedOurs
      ? `  remember to also: npm uninstall -g context-check`
      : `  removed your custom statusLine (forced); restore from .bak if this was a mistake`)
  );
}

module.exports = { run };
