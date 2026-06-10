'use strict';

const path = require('node:path');

const { ANSI, color, dim } = require('./ansi');
const { isFiniteNumber, isNonEmptyString, clampPercent } = require('./predicates');
const FillPercent = require('./fill-percent');
const { resolveFill } = require('./resolve-fill');
const FillSource = require('./fill-source');
const Turns = require('./turns');
const { resolveTurns } = require('./transcript');
const Strain = require('./strain');
const Zone = require('./zones');

const FULL_BAR_WIDTH = 20;
const LINE_BAR_WIDTH = 10;
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

  render(lineMode) {
    return (lineMode ? this.renderLine() : this.renderFull()) + '\n';
  }

  renderFull() {
    const lines = [];
    lines.push(prefixWithDir(this.dir, this.model));
    lines.push(`${renderBar(FULL_BAR_WIDTH, this.fill, this.zone)}  ${this.fill.label()}${this.source.tag()}`);
    lines.push(dim(`turns: ${this.turns.label()}`));
    lines.push(`zone: ${this.zone.paint(this.zone.name)}`);
    lines.push(this.zone.advice);
    if (this.autoCompactReached) {
      lines.push(autoCompactWarnLine(this.autoCompactThreshold));
    }
    lines.push(dim(`drift est. uses ${Strain.FILL_COEF}·fill + ${Strain.DEPTH_COEF}·depth — a hypothesis, not measured.`));
    return lines.join('\n');
  }

  renderLine() {
    const head = prefixWithDir(this.dir, this.model);
    return `${head} ${renderBar(LINE_BAR_WIDTH, this.fill, this.zone)} ${this.fill.label()} ${this.zone.paint(this.zone.name)}${warnSuffix(this.autoCompactReached)}`;
  }
}

function prefixWithDir(dir, head) {
  return dir ? `${dir} | ${head}` : head;
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

function renderBar(width, fill, zone) {
  return zone.paint(fill.barString(width));
}

function warnSuffix(autoCompactReached) {
  return autoCompactReached ? ' ⚠' : '';
}

function autoCompactWarnLine(threshold) {
  return color(ANSI.yellow, `⚠ auto-compact threshold (${threshold}%) reached`);
}

module.exports = SessionState;
