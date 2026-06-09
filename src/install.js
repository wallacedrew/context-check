'use strict';

const { readFile, writeFile, mkdir } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const STATUSLINE_COMMAND = 'context-check --line';
const DESIRED_STATUSLINE = { type: 'command', command: STATUSLINE_COMMAND };

async function run(args) {
  const settingsPath = resolveSettingsPath(args);
  const force = args.includes('--force');

  const loadResult = await loadSettings(settingsPath);
  if (loadResult.error) {
    print(`context-check install: ${loadResult.error}`);
    process.exitCode = 1;
    return;
  }

  const { settings, existed } = loadResult;

  if (isAlreadyConfigured(settings)) {
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

  const next = { ...settings, statusLine: DESIRED_STATUSLINE };
  await writeFile(settingsPath, JSON.stringify(next, null, 2) + '\n');

  print(
    `context-check install: wrote statusLine to ${settingsPath}.\n` +
    (existed ? `  backup: ${settingsPath}.bak\n` : '') +
    `  reload Claude Code to see the gauge`
  );
}

function resolveSettingsPath(args) {
  const flagIndex = args.indexOf('--settings');
  if (flagIndex !== -1 && flagIndex + 1 < args.length) return args[flagIndex + 1];
  return path.join(os.homedir(), '.claude', 'settings.json');
}

async function loadSettings(settingsPath) {
  if (!existsSync(settingsPath)) return { settings: {}, existed: false };
  const raw = await readFile(settingsPath, 'utf8');
  if (raw.trim() === '') return { settings: {}, existed: true };
  try {
    return { settings: JSON.parse(raw), existed: true };
  } catch (_) {
    return { error: `${settingsPath} is not valid JSON; aborting` };
  }
}

function isAlreadyConfigured(settings) {
  const current = settings.statusLine;
  return current && current.type === 'command' && current.command === STATUSLINE_COMMAND;
}

function hasConflictingStatusLine(settings) {
  return settings.statusLine != null && !isAlreadyConfigured(settings);
}

function print(message) {
  process.stdout.write(message + '\n');
}

module.exports = { run };
