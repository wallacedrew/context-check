'use strict';

class Turns {
  constructor(count) {
    this._count = count;
  }

  static unknown() {
    return new Turns(null);
  }

  static of(count) {
    return new Turns(count);
  }

  isUnknown() {
    return this._count === null;
  }

  label() {
    return this.isUnknown() ? '~?' : String(this._count);
  }

  ratio(normalizer) {
    return Math.min(1, (this._count || 0) / normalizer);
  }
}

module.exports = Turns;
