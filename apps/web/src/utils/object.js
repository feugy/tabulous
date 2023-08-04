// @ts-check
/**
 * Returns a (deeply nested) property of an object.
 * Supports objects and arrays.
 * @param {?} object  - root object.
 * @param {(string|number)[]} path - array of segments to the desired property
 * @returns {?} the property found, or undefined
 */
export function getValue(object, path) {
  for (let index = 0; index < path.length; index++) {
    if (!object) {
      return undefined
    }
    object = object[path[index]]
  }
  return object
}
