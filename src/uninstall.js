'use strict';

const { writeFile } = require('node:fs/promises');

const {
  resolveSettingsPath,
  loadSettings,
  isAlreadyConfigured,
  hasConflictingStatusLine,
} = require('./settings');

async function run(args) {
  const settingsPath = resolveSettingsPath(args);
  const force = args.includes('--force');

  const loadResult = await loadSettings(settingsPath);
  if (loadResult.error) {
    print(`context-check uninstall: ${loadResult.error}`);
    process.exitCode = 1;
    return;
  }

  const { settings, existed } = loadResult;

  if (!existed) {
    print(`context-check uninstall: ${settingsPath} does not exist; nothing to do`);
    return;
  }

  if (settings.statusLine == null) {
    print(`context-check uninstall: no statusLine configured in ${settingsPath}; nothing to do`);
    return;
  }

  if (hasConflictingStatusLine(settings) && !force) {
    print(
      `context-check uninstall: ${settingsPath} has a different statusLine.\n` +
      `  current: ${JSON.stringify(settings.statusLine)}\n` +
      `  rerun with --force to remove it anyway`
    );
    process.exitCode = 1;
    return;
  }

  await writeFile(settingsPath + '.bak', JSON.stringify(settings, null, 2) + '\n');

  const next = { ...settings };
  delete next.statusLine;
  await writeFile(settingsPath, JSON.stringify(next, null, 2) + '\n');

  const removedOurs = isAlreadyConfigured(settings);
  print(
    `context-check uninstall: removed statusLine from ${settingsPath}.\n` +
    `  backup: ${settingsPath}.bak\n` +
    (removedOurs
      ? `  remember to also: npm uninstall -g context-check`
      : `  removed your custom statusLine (forced); restore from .bak if this was a mistake`)
  );
}

function print(message) {
  process.stdout.write(message + '\n');
}

module.exports = { run };
