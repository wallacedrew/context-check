'use strict';

const { readFile, writeFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BASIC_COMMAND = 'context-check --line';
const WITH_DIR_COMMAND = 'context-check --line --with-dir';
const OUR_COMMANDS = new Set([BASIC_COMMAND, WITH_DIR_COMMAND]);
const BACKUP_SUFFIX = '.bak';

function backupPathFor(settingsPath) {
  return settingsPath + BACKUP_SUFFIX;
}

function commandFor(options) {
  return options && options.withDir ? WITH_DIR_COMMAND : BASIC_COMMAND;
}

function statusLineFor(options) {
  return { type: 'command', command: commandFor(options) };
}

function isOurCommand(command) {
  return typeof command === 'string' && OUR_COMMANDS.has(command);
}

function isOurStatusLine(settings) {
  const current = settings.statusLine;
  return Boolean(current) && current.type === 'command' && isOurCommand(current.command);
}

function isAlreadyConfigured(settings, options) {
  const current = settings.statusLine;
  return Boolean(current) && current.type === 'command' && current.command === commandFor(options);
}

function hasConflictingStatusLine(settings) {
  return settings.statusLine != null && !isOurStatusLine(settings);
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

async function writeSettings(settingsPath, settings) {
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

async function writeBackup(settingsPath, settings) {
  await writeSettings(backupPathFor(settingsPath), settings);
}

function withoutStatusLine(settings) {
  const { statusLine: _removed, ...rest } = settings;
  return rest;
}

function withStatusLine(settings, options) {
  return { ...settings, statusLine: statusLineFor(options) };
}

module.exports = {
  BASIC_COMMAND,
  OUR_COMMANDS,
  BACKUP_SUFFIX,
  backupPathFor,
  commandFor,
  statusLineFor,
  isOurCommand,
  isOurStatusLine,
  isAlreadyConfigured,
  hasConflictingStatusLine,
  resolveSettingsPath,
  loadSettings,
  writeSettings,
  writeBackup,
  withoutStatusLine,
  withStatusLine,
};
