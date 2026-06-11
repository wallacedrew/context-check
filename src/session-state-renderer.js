'use strict';

const { ANSI, color, dim } = require('./ansi');
const Strain = require('./strain');

const FULL_BAR_WIDTH = 20;
const LINE_BAR_WIDTH = 10;

class SessionStateRenderer {
  constructor(state) {
    this.state = state;
  }

  render(lineMode) {
    return (lineMode ? this.renderLine() : this.renderFull()) + '\n';
  }

  renderFull() {
    const { model, fill, source, turns, zone, autoCompactThreshold, autoCompactReached, dir } = this.state;
    const lines = [];
    lines.push(prefixWithDir(dir, model));
    lines.push(`${renderBar(FULL_BAR_WIDTH, fill, zone)}  ${fill.label()}${source.tag()}`);
    lines.push(dim(`turns: ${turns.label()}`));
    lines.push(`zone: ${zone.paint(zone.name)}`);
    lines.push(zone.advice);
    if (autoCompactReached) {
      lines.push(autoCompactWarnLine(autoCompactThreshold));
    }
    lines.push(dim(`drift est. uses ${Strain.FILL_COEF}·fill + ${Strain.DEPTH_COEF}·depth — a hypothesis, not measured.`));
    return lines.join('\n');
  }

  renderLine() {
    const { model, fill, zone, autoCompactReached, dir } = this.state;
    const head = prefixWithDir(dir, model);
    return `${head} ${renderBar(LINE_BAR_WIDTH, fill, zone)} ${fill.label()} ${zone.paint(zone.name)}${warnSuffix(autoCompactReached)}`;
  }
}

function prefixWithDir(dir, head) {
  return dir ? `${dir} | ${head}` : head;
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

module.exports = SessionStateRenderer;
