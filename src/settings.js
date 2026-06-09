'use strict';

const { readFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const STATUSLINE_COMMAND = 'context-check --line';
const DESIRED_STATUSLINE = { type: 'command', command: STATUSLINE_COMMAND };

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

module.exports = {
  STATUSLINE_COMMAND,
  DESIRED_STATUSLINE,
  resolveSettingsPath,
  loadSettings,
  isAlreadyConfigured,
  hasConflictingStatusLine,
};
