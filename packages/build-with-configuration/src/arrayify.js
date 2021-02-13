/**
 * @template T
 * @param {T[]|T|undefined} possibleArray
 * @returns {T[]}
 */
export function arrayify(possibleArray) {
  if (possibleArray == null) {
    return []
  } else if (Array.isArray(possibleArray)) {
    return possibleArray
  } else {
    return [possibleArray]
  }
}
