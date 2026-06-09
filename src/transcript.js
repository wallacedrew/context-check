'use strict';

const fs = require('fs');
const { isObject, isString, isNonEmptyString } = require('./predicates');
const Turns = require('./turns');

// Turn-depth from transcript JSONL: only user + assistant message records
// count; tool-call records inflate raw line count.
function resolveTurns(transcriptPath) {
  const content = readTranscriptContent(transcriptPath);
  if (content === null) return Turns.unknown();
  const count = content
    .split('\n')
    .map(parseJsonOrNull)
    .filter(record => record !== null)
    .map(recordRole)
    .filter(isMessageRole)
    .length;
  return Turns.of(count);
}

function readTranscriptContent(transcriptPath) {
  if (!isNonEmptyString(transcriptPath)) return null;
  try { return fs.readFileSync(transcriptPath, 'utf8'); }
  catch (_) { return null; }
}

function parseJsonOrNull(line) {
  if (!line.trim()) return null;
  try { return JSON.parse(line); }
  catch (_) { return null; }
}

function recordRole(record) {
  if (!isObject(record)) return null;
  if (isString(record.role)) return record.role;
  if (record.message && isString(record.message.role)) return record.message.role;
  if (isString(record.type)) return record.type;
  return null;
}

function isMessageRole(role) {
  return role === 'user' || role === 'assistant';
}

module.exports = { resolveTurns };
