'use strict';

const ANSI = {
  green: 32,
  yellow: 33,
  red: 31,
  dim: 90,
  faint: 2,
};

function colorEnabled() {
  return !process.env.NO_COLOR;
}

function color(code, text) {
  if (!colorEnabled()) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

function dim(text) {
  return color(ANSI.faint, text);
}

module.exports = { ANSI, color, dim };
