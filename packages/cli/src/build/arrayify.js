'use strict'

/**
 * @template T
 * @param {T[]|T} possibleArray
 * @returns {T[]|undefined}
 */
function arrayify(possibleArray) {
  if (possibleArray == null) return undefined
  if (Array.isArray(possibleArray)) return possibleArray
  return [possibleArray]
}

module.exports = {arrayify}
