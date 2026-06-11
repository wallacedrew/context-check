'use strict';

const { isFiniteNumber, clampPercent } = require('./predicates');

class FillPercent {
  constructor(value) {
    this._value = value;
  }

  static blind() {
    return new FillPercent(null);
  }

  static of(rawNumber) {
    if (!isFiniteNumber(rawNumber)) return FillPercent.blind();
    return new FillPercent(clampPercent(Math.round(rawNumber)));
  }

  isBlind() {
    return this._value === null;
  }

  atLeast(threshold) {
    return !this.isBlind() && this._value >= threshold;
  }

  ratio() {
    return this.toNumberOrZero() / 100;
  }

  label() {
    return this.isBlind() ? '--%' : `${this._value}%`;
  }

  toNumberOrZero() {
    return this._value || 0;
  }

  barString(width) {
    const filled = Math.max(0, Math.min(width, Math.round(this.ratio() * width)));
    const empty = width - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }
}

module.exports = FillPercent;
