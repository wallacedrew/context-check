'use strict';

const { isFiniteNumber, isObject, toNumber } = require('./predicates');
const FillPercent = require('./fill-percent');
const FillSource = require('./fill-source');

const DEFAULT_CONTEXT_WINDOW_SIZE = 200000;

function resolveFill(input) {
  const contextWindow = input && input.context_window;

  if (contextWindow && isFiniteNumber(contextWindow.used_percentage)) {
    return { fill: FillPercent.of(contextWindow.used_percentage), source: FillSource.USED_PERCENTAGE };
  }

  const currentUsage = input && input.current_usage;
  if (isObject(currentUsage)) {
    const fill = fillFromCurrentUsage(currentUsage, contextWindow);
    if (!fill.isBlind()) return { fill, source: FillSource.CURRENT_USAGE };
  }

  return { fill: FillPercent.blind(), source: FillSource.UNKNOWN };
}

function fillFromCurrentUsage(currentUsage, contextWindow) {
  const tokens = toNumber(currentUsage.input_tokens)
    + toNumber(currentUsage.cache_read_input_tokens)
    + toNumber(currentUsage.cache_creation_input_tokens);
  const maxTokens = toNumber(contextWindow && contextWindow.context_window_size)
    || toNumber(currentUsage.max_tokens)
    || DEFAULT_CONTEXT_WINDOW_SIZE;
  if (maxTokens > 0 && tokens > 0) {
    return FillPercent.of((tokens / maxTokens) * 100);
  }
  return FillPercent.blind();
}

module.exports = { resolveFill };
