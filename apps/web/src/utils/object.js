export function getValue(object, path) {
  for (let index = 0; index < path.length; index++) {
    if (!object) {
      return undefined
    }
    object = object[path[index]]
  }
  return object
}
