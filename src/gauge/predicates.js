'use strict';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value) {
  return typeof value === 'string';
}

function isNonEmptyString(value) {
  return isString(value) && value.length > 0;
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function toNumber(value) {
  return isFiniteNumber(value) ? value : 0;
}

function clampPercent(percent) {
  if (!isFiniteNumber(percent)) return 0;
  return Math.max(0, Math.min(100, percent));
}

module.exports = { isFiniteNumber, isString, isNonEmptyString, isObject, toNumber, clampPercent };
