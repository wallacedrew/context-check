'use strict';

const { dim } = require('./ansi');

class FillSource {
  constructor(tag) {
    this._tag = tag;
  }

  isUnknown() {
    return this._tag === null;
  }

  tag() {
    return this.isUnknown() ? '' : ' ' + dim(`[${this._tag}]`);
  }
}

FillSource.USED_PERCENTAGE = new FillSource('used_percentage');
FillSource.CURRENT_USAGE   = new FillSource('current_usage');
FillSource.DEMO            = new FillSource('demo');
FillSource.UNKNOWN         = new FillSource(null);

module.exports = FillSource;
