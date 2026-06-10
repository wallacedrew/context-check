'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'src', 'context-check.js');

function runBin(args, stdinText) {
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
    if (stdinText !== null && stdinText !== undefined) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();
  });
}

const HYPOTHESIS_LINE =
  'drift est. uses 0.7·fill + 0.3·depth — a hypothesis, not measured.';

test('--with-dir prefixes the --line row with the workspace folder basename', async () => {
  const input = '{"workspace":{"current_dir":"/Users/jane/Code/my-app"},"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":42}}';
  const { stdout, exitCode } = await runBin(['--line', '--with-dir'], input);
  assert.equal(exitCode, 0);
  assert.equal(stdout, 'my-app | Opus 4.8 ▓▓▓▓░░░░░░ 42% sharp\n');
});

test('--with-dir without workspace.current_dir omits the prefix gracefully', async () => {
  const input = '{"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":42}}';
  const { stdout, exitCode } = await runBin(['--line', '--with-dir'], input);
  assert.equal(exitCode, 0);
  assert.equal(stdout, 'Opus 4.8 ▓▓▓▓░░░░░░ 42% sharp\n');
});

test('without --with-dir, workspace.current_dir is ignored', async () => {
  const input = '{"workspace":{"current_dir":"/Users/jane/Code/my-app"},"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":42}}';
  const { stdout, exitCode } = await runBin(['--line'], input);
  assert.equal(exitCode, 0);
  assert.equal(stdout, 'Opus 4.8 ▓▓▓▓░░░░░░ 42% sharp\n');
});

test('--demo --line --with-dir shows the stub my-project prefix', async () => {
  const { stdout, exitCode } = await runBin(['--demo', '--line', '--with-dir']);
  assert.equal(exitCode, 0);
  assert.equal(stdout, 'my-project | Opus 4.8 (demo) ▓▓▓▓▓▓░░░░ 62% drift risk\n');
});

test('--with-dir in full-gauge mode prefixes only the model line', async () => {
  const input = '{"workspace":{"current_dir":"/Users/jane/Code/my-app"},"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":28}}';
  const { stdout, exitCode } = await runBin(['--with-dir'], input);
  assert.equal(exitCode, 0);
  assert.equal(
    stdout,
    'my-app | Opus 4.8\n' +
    '▓▓▓▓▓▓░░░░░░░░░░░░░░  28% [used_percentage]\n' +
    'turns: ~?\n' +
    'zone: crisp\n' +
    'fresh. full headroom. nothing to do.\n' +
    HYPOTHESIS_LINE + '\n',
  );
});
