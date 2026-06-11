'use strict';

const path = require('node:path');

const { isFiniteNumber, isNonEmptyString, clampPercent } = require('./predicates');
const FillPercent = require('./fill-percent');
const { resolveFill } = require('./resolve-fill');
const FillSource = require('./fill-source');
const Turns = require('./turns');
const { resolveTurns } = require('./transcript');
const Strain = require('./strain');
const Zone = require('./zones');

const DEFAULT_AUTO_COMPACT_THRESHOLD = 80;

class SessionState {
  constructor({ model, fill, source, turns, zone, autoCompactThreshold, autoCompactReached, dir }) {
    this.model = model;
    this.fill = fill;
    this.source = source;
    this.turns = turns;
    this.zone = zone;
    this.autoCompactThreshold = autoCompactThreshold;
    this.autoCompactReached = autoCompactReached;
    this.dir = dir;
  }

  static fromInput(input, options = {}) {
    const model = resolveModel(input);
    const { fill, source } = resolveFill(input);
    const turns = resolveTurns(input && input.transcript_path);
    const strain = Strain.fromMetrics(fill, turns);
    const zone = Zone.resolveFor(fill, strain);
    const autoCompactThreshold = resolveAutoCompactThreshold(input);
    const autoCompactReached = fill.atLeast(autoCompactThreshold);
    const dir = options.withDir ? resolveDir(input) : null;
    return new SessionState({ model, fill, source, turns, zone, autoCompactThreshold, autoCompactReached, dir });
  }

  static demo(options = {}) {
    return new SessionState({
      model: 'Opus 4.8 (demo)',
      fill: FillPercent.of(62),
      source: FillSource.DEMO,
      turns: Turns.of(0),
      zone: Zone.DRIFT,
      autoCompactThreshold: DEFAULT_AUTO_COMPACT_THRESHOLD,
      autoCompactReached: false,
      dir: options.withDir ? 'my-project' : null,
    });
  }
}

function resolveDir(input) {
  const workspace = input && input.workspace;
  const current = workspace && workspace.current_dir;
  if (!isNonEmptyString(current)) return null;
  return path.basename(current);
}

function resolveModel(input) {
  const model = input && input.model;
  if (model && isNonEmptyString(model.display_name)) return model.display_name;
  if (model && isNonEmptyString(model.id)) return model.id;
  return 'unknown model';
}

function resolveAutoCompactThreshold(input) {
  const contextWindow = input && input.context_window;
  const raw = contextWindow && contextWindow.auto_compact_threshold_percent;
  if (isFiniteNumber(raw)) return clampPercent(Math.round(raw));
  return DEFAULT_AUTO_COMPACT_THRESHOLD;
}

module.exports = SessionState;
