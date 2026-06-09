'use strict';

class Strain {
  constructor(value) {
    this._value = value;
  }

  // Coefficients are a HYPOTHESIS, not calibrated — keep them named so they
  // are trivially swappable.
  static FILL_COEF = 0.7;
  static DEPTH_COEF = 0.3;
  static DEPTH_NORMALIZER = 80;

  static fromMetrics(fill, turns) {
    const value = fill.ratio() * Strain.FILL_COEF
      + turns.ratio(Strain.DEPTH_NORMALIZER) * Strain.DEPTH_COEF;
    return new Strain(value);
  }

  atLeast(threshold) {
    return this._value >= threshold;
  }
}

module.exports = Strain;
