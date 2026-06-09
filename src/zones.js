'use strict';

const { ANSI, color } = require('./ansi');

const COMPACTION_WALL_PERCENT = 88;
const DILUTION_STRAIN = 0.62;
const DRIFT_STRAIN = 0.42;
const SHARP_STRAIN = 0.22;

class Zone {
  constructor(name, advice, colorCode) {
    this.name = name;
    this.advice = advice;
    this._colorCode = colorCode;
  }

  paint(text) {
    return color(this._colorCode, text);
  }

  static resolveFor(fill, strain) {
    if (fill.isBlind()) return Zone.BLIND;
    if (fill.atLeast(COMPACTION_WALL_PERCENT)) return Zone.WALL;
    if (strain.atLeast(DILUTION_STRAIN)) return Zone.DILUTION;
    if (strain.atLeast(DRIFT_STRAIN)) return Zone.DRIFT;
    if (strain.atLeast(SHARP_STRAIN)) return Zone.SHARP;
    return Zone.CRISP;
  }
}

Zone.BLIND    = new Zone('blind',           'no usage yet (pre-first-call or just compacted). gauge resumes next turn.', ANSI.dim);
Zone.CRISP    = new Zone('crisp',           'fresh. full headroom. nothing to do.',                                      ANSI.green);
Zone.SHARP    = new Zone('sharp',           'comfortable. recent context dominant. good adherence.',                    ANSI.green);
Zone.DRIFT    = new Zone('drift risk',      'long arc — earliest instructions decaying. restate hard constraints.',     ANSI.yellow);
Zone.DILUTION = new Zone('dilution',        'high fill. specifics get flattened. consider /compact soon.',              ANSI.red);
Zone.WALL     = new Zone('compaction wall', 'near limit. truncation imminent. /compact now.',                           ANSI.red);

module.exports = Zone;
