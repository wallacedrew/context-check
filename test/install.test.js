'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, writeFile, readFile, access } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'src', 'context-check.js');

function runBin(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [BIN, ...args], {
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ stdout, stderr, exitCode }));
    child.stdin.end();
  });
}

async function makeTmpDir() {
  return await mkdtemp(path.join(tmpdir(), 'context-check-install-'));
}

const DESIRED_STATUSLINE = { type: 'command', command: 'context-check --line' };

test('install: writes a fresh settings.json with the statusline block when target is missing', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');

  const { exitCode } = await runBin(['install', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(settings.statusLine, DESIRED_STATUSLINE);
});

test('install: preserves existing keys and merges statusLine into an existing settings.json', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify({
    permissions: { defaultMode: 'auto' },
    theme: 'light',
  }, null, 2));

  const { exitCode } = await runBin(['install', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(settings.statusLine, DESIRED_STATUSLINE);
  assert.deepEqual(settings.permissions, { defaultMode: 'auto' });
  assert.equal(settings.theme, 'light');
});

test('install: writes a .bak alongside the original when target file exists', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  const originalSettings = { theme: 'light' };
  await writeFile(settingsPath, JSON.stringify(originalSettings, null, 2));

  const { exitCode } = await runBin(['install', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  const backup = JSON.parse(await readFile(settingsPath + '.bak', 'utf8'));
  assert.deepEqual(backup, originalSettings);
});

test('install: no-op when the statusline command is already configured', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify({ statusLine: DESIRED_STATUSLINE }, null, 2));

  const { stdout, exitCode } = await runBin(['install', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  assert.match(stdout, /already configured/i);
});

test('install: refuses to overwrite a different statusLine without --force', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  const existing = { statusLine: { type: 'command', command: 'my-custom-statusline' } };
  await writeFile(settingsPath, JSON.stringify(existing, null, 2));

  const { stdout, exitCode } = await runBin(['install', '--settings', settingsPath]);

  assert.equal(exitCode, 1);
  assert.match(stdout, /--force/);
  const unchanged = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(unchanged, existing);
});

test('install: --force overwrites an existing different statusLine', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify({
    statusLine: { type: 'command', command: 'my-custom-statusline' },
  }, null, 2));

  const { exitCode } = await runBin(['install', '--settings', settingsPath, '--force']);

  assert.equal(exitCode, 0);
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(settings.statusLine, DESIRED_STATUSLINE);
});

test('install --with-dir writes the with-dir variant of the statusLine command', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');

  const { exitCode } = await runBin(['install', '--with-dir', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(settings.statusLine, { type: 'command', command: 'context-check --line --with-dir' });
});

test('install --with-dir is idempotent when the with-dir variant is already configured', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify({
    statusLine: { type: 'command', command: 'context-check --line --with-dir' },
  }, null, 2));

  const { stdout, exitCode } = await runBin(['install', '--with-dir', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  assert.match(stdout, /already configured/i);
});

test('install --with-dir swaps a basic configuration to the with-dir variant without --force', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify({
    statusLine: { type: 'command', command: 'context-check --line' },
  }, null, 2));

  const { exitCode } = await runBin(['install', '--with-dir', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(settings.statusLine, { type: 'command', command: 'context-check --line --with-dir' });
});

test('install (no --with-dir) swaps a with-dir configuration back to basic without --force', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify({
    statusLine: { type: 'command', command: 'context-check --line --with-dir' },
  }, null, 2));

  const { exitCode } = await runBin(['install', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(settings.statusLine, { type: 'command', command: 'context-check --line' });
});

test('install: malformed JSON aborts with exit 1 and leaves file untouched', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, '{ this is not json');

  const { exitCode } = await runBin(['install', '--settings', settingsPath]);

  assert.equal(exitCode, 1);
  const raw = await readFile(settingsPath, 'utf8');
  assert.equal(raw, '{ this is not json');
});
