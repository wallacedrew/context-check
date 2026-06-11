'use strict';

function makeReporter(prefix) {
  function emit(message) {
    process.stdout.write(`${prefix} ${message}\n`);
  }
  return {
    info(message) {
      emit(message);
    },
    fail(message) {
      emit(message);
      process.exitCode = 1;
    },
  };
}

module.exports = { makeReporter };
