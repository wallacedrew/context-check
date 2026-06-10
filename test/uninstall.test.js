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
  return await mkdtemp(path.join(tmpdir(), 'context-check-uninstall-'));
}

const OUR_STATUSLINE = { type: 'command', command: 'context-check --line' };

test('uninstall: removes the statusLine block when it points at context-check', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify({
    statusLine: OUR_STATUSLINE,
    theme: 'light',
  }, null, 2));

  const { exitCode } = await runBin(['uninstall', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.equal(settings.statusLine, undefined);
  assert.equal(settings.theme, 'light');
});

test('uninstall: writes a .bak alongside the original before removing', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  const original = { statusLine: OUR_STATUSLINE, theme: 'light' };
  await writeFile(settingsPath, JSON.stringify(original, null, 2));

  const { exitCode } = await runBin(['uninstall', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  const backup = JSON.parse(await readFile(settingsPath + '.bak', 'utf8'));
  assert.deepEqual(backup, original);
});

test('uninstall: no-op when settings.json has no statusLine', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  const original = { theme: 'light' };
  await writeFile(settingsPath, JSON.stringify(original, null, 2));

  const { stdout, exitCode } = await runBin(['uninstall', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  assert.match(stdout, /nothing to do/i);
  const unchanged = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(unchanged, original);
});

test('uninstall: no-op when settings.json does not exist', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');

  const { stdout, exitCode } = await runBin(['uninstall', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  assert.match(stdout, /nothing to do/i);
  await assert.rejects(access(settingsPath));
});

test('uninstall: refuses to remove a different statusLine without --force', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  const existing = { statusLine: { type: 'command', command: 'my-custom-statusline' } };
  await writeFile(settingsPath, JSON.stringify(existing, null, 2));

  const { stdout, exitCode } = await runBin(['uninstall', '--settings', settingsPath]);

  assert.equal(exitCode, 1);
  assert.match(stdout, /--force/);
  const unchanged = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.deepEqual(unchanged, existing);
});

test('uninstall: --force removes any statusLine', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify({
    statusLine: { type: 'command', command: 'my-custom-statusline' },
    theme: 'light',
  }, null, 2));

  const { exitCode } = await runBin(['uninstall', '--settings', settingsPath, '--force']);

  assert.equal(exitCode, 0);
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.equal(settings.statusLine, undefined);
  assert.equal(settings.theme, 'light');
});

test('uninstall recognizes the --with-dir variant as ours and removes without --force', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify({
    statusLine: { type: 'command', command: 'context-check --line --with-dir' },
    theme: 'light',
  }, null, 2));

  const { exitCode } = await runBin(['uninstall', '--settings', settingsPath]);

  assert.equal(exitCode, 0);
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.equal(settings.statusLine, undefined);
  assert.equal(settings.theme, 'light');
});

test('uninstall: malformed JSON aborts with exit 1 and leaves file untouched', async () => {
  const dir = await makeTmpDir();
  const settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, '{ this is not json');

  const { exitCode } = await runBin(['uninstall', '--settings', settingsPath]);

  assert.equal(exitCode, 1);
  const raw = await readFile(settingsPath, 'utf8');
  assert.equal(raw, '{ this is not json');
});
