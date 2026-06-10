'use strict';

const { writeFile, mkdir } = require('node:fs/promises');
const path = require('node:path');

const {
  statusLineFor,
  resolveSettingsPath,
  loadSettings,
  isAlreadyConfigured,
  hasConflictingStatusLine,
} = require('./settings');

async function run(args) {
  const settingsPath = resolveSettingsPath(args);
  const force = args.includes('--force');
  const options = {};

  const loadResult = await loadSettings(settingsPath);
  if (loadResult.error) {
    print(`context-check install: ${loadResult.error}`);
    process.exitCode = 1;
    return;
  }

  const { settings, existed } = loadResult;

  if (isAlreadyConfigured(settings, options)) {
    print(`context-check install: statusLine already configured in ${settingsPath}; nothing to do`);
    return;
  }

  if (hasConflictingStatusLine(settings) && !force) {
    print(
      `context-check install: ${settingsPath} already has a different statusLine.\n` +
      `  current: ${JSON.stringify(settings.statusLine)}\n` +
      `  rerun with --force to overwrite`
    );
    process.exitCode = 1;
    return;
  }

  if (existed) {
    await writeFile(settingsPath + '.bak', JSON.stringify(settings, null, 2) + '\n');
  } else {
    await mkdir(path.dirname(settingsPath), { recursive: true });
  }

  const next = { ...settings, statusLine: statusLineFor(options) };
  await writeFile(settingsPath, JSON.stringify(next, null, 2) + '\n');

  print(
    `context-check install: wrote statusLine to ${settingsPath}.\n` +
    (existed ? `  backup: ${settingsPath}.bak\n` : '') +
    `  reload Claude Code to see the gauge`
  );
}

function print(message) {
  process.stdout.write(message + '\n');
}

module.exports = { run };
