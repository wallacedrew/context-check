'use strict';

function makeReporter(prefix) {
  return (message) => process.stdout.write(`${prefix} ${message}\n`);
}

module.exports = { makeReporter };
