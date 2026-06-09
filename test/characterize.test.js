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

test('case 1: --demo renders the canned 62% drift-risk full gauge', async () => {
  const { stdout, exitCode } = await runBin(['--demo']);
  assert.equal(exitCode, 0);
  assert.equal(
    stdout,
    'Opus 4.8 (demo)\n' +
    '▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  62% [demo]\n' +
    'turns: 0\n' +
    'zone: drift risk\n' +
    'long arc — earliest instructions decaying. restate hard constraints.\n' +
    HYPOTHESIS_LINE + '\n',
  );
});

test('case 1b: --demo --line renders the canned 62% single-row gauge', async () => {
  const { stdout, exitCode } = await runBin(['--demo', '--line']);
  assert.equal(exitCode, 0);
  assert.equal(stdout, 'Opus 4.8 (demo) ▓▓▓▓▓▓░░░░ 62% drift risk\n');
});

test('case 2: healthy 28% is crisp', async () => {
  const input = '{"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":28}}';
  const { stdout, exitCode } = await runBin([], input);
  assert.equal(exitCode, 0);
  assert.equal(
    stdout,
    'Opus 4.8\n' +
    '▓▓▓▓▓▓░░░░░░░░░░░░░░  28% [used_percentage]\n' +
    'turns: ~?\n' +
    'zone: crisp\n' +
    'fresh. full headroom. nothing to do.\n' +
    HYPOTHESIS_LINE + '\n',
  );
});

test('case 3: 91% is compaction wall with auto-compact warning', async () => {
  const input = '{"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":91}}';
  const { stdout, exitCode } = await runBin([], input);
  assert.equal(exitCode, 0);
  assert.equal(
    stdout,
    'Opus 4.8\n' +
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  91% [used_percentage]\n' +
    'turns: ~?\n' +
    'zone: compaction wall\n' +
    'near limit. truncation imminent. /compact now.\n' +
    '⚠ auto-compact threshold (80%) reached\n' +
    HYPOTHESIS_LINE + '\n',
  );
});

test('case 4: empty context_window renders blind state without crashing', async () => {
  const input = '{"model":{"display_name":"Opus 4.8"},"context_window":{}}';
  const { stdout, exitCode } = await runBin([], input);
  assert.equal(exitCode, 0);
  assert.equal(
    stdout,
    'Opus 4.8\n' +
    '░░░░░░░░░░░░░░░░░░░░  --%\n' +
    'turns: ~?\n' +
    'zone: blind\n' +
    'no usage yet (pre-first-call or just compacted). gauge resumes next turn.\n' +
    HYPOTHESIS_LINE + '\n',
  );
});

test('case 5: --line at 83% renders single drift-risk row with ⚠', async () => {
  const input = '{"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":83}}';
  const { stdout, exitCode } = await runBin(['--line'], input);
  assert.equal(exitCode, 0);
  assert.equal(stdout, 'Opus 4.8 ▓▓▓▓▓▓▓▓░░ 83% drift risk ⚠\n');
});

test('case 6: invalid JSON prints one graceful line and exits 0', async () => {
  const { stdout, exitCode } = await runBin([], 'not json');
  assert.equal(exitCode, 0);
  assert.equal(stdout, 'context-check: invalid JSON on stdin\n');
});

test('case 7: current_usage fallback computes ~60% with source tag', async () => {
  const input = '{"context_window":{"context_window_size":200000},"current_usage":{"input_tokens":100000,"cache_read_input_tokens":20000}}';
  const { stdout, exitCode } = await runBin([], input);
  assert.equal(exitCode, 0);
  assert.equal(
    stdout,
    'unknown model\n' +
    '▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  60% [current_usage]\n' +
    'turns: ~?\n' +
    'zone: drift risk\n' +
    'long arc — earliest instructions decaying. restate hard constraints.\n' +
    HYPOTHESIS_LINE + '\n',
  );
});

test('case 8: absurd 340% used_percentage clamps to 100% without throwing', async () => {
  const input = '{"context_window":{"used_percentage":340}}';
  const { stdout, exitCode } = await runBin([], input);
  assert.equal(exitCode, 0);
  assert.equal(
    stdout,
    'unknown model\n' +
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  100% [used_percentage]\n' +
    'turns: ~?\n' +
    'zone: compaction wall\n' +
    'near limit. truncation imminent. /compact now.\n' +
    '⚠ auto-compact threshold (80%) reached\n' +
    HYPOTHESIS_LINE + '\n',
  );
});
