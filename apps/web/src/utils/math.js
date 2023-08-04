// @ts-check
/**
 * @typedef {import('@babylonjs/core').Vector3} Vector3
 * @typedef {import('@babylonjs/core').BoundingBox} BoundingBox
 * @typedef {import('@src/3d/utils').ScreenPosition} ScreenPosition
 */

/**
 * @typedef {object} Rectangle A 2D rectangle defined by its minimum and maximum points.
 * @property {ScreenPosition} min - a 2D point representing the lowest corner of this rectangle.
 * @property {ScreenPosition} max - a 2D point representing the highest corner of this rectangle.
 */

/**
 * @typedef {object} Circle A 2D circle defined by its center point and radius.
 * @property {ScreenPosition} center - a 2D point representing center.
 * @property {number} radius - a radius distance.
 */

/**
 * Turns an angle from radian to degree.
 * @param {number} radian - angle in radian.
 * @return {number} same angle in degree.
 */
export function toDeg(radian) {
  return radian * (180 / Math.PI)
}

/**
 * Turns an angle from degree to radian.
 * @param {number} degree - angle in degree.
 * @returns {number} same angle in radian.
 */
export function toRad(degree) {
  return (degree * Math.PI) / 180
}

/**
 * Normalize a value from a input range [-maxInput..maxInput] within an output range [min..max]
 * @param {number} value - normalized value
 * @param {number} maxInput - maximum input value (used for both negative and positive)
 * @param {number} min - minimum output value, positive
 * @param {number} max - maximum output value, positive
 * @returns {number} the normalized value within [min..max]
 */
export function normalize(value, maxInput, min, max) {
  // normalize within [0..1], then apply to [min..max]
  const result =
    min + (Math.min(Math.abs(value), maxInput) / maxInput) * (max - min)
  return value < 0 ? -result : result
}

/**
 * Computes Euclidean distance between two (screen coordinates) points.
 * @param {ScreenPosition} first - first screen position.
 * @param {ScreenPosition} second - second screen position.
 */
export function distance(first, second) {
  return Math.sqrt(
    Math.pow(first.x - second.x, 2) + Math.pow(first.y - second.y, 2)
  )
}

/**
 * Projects a point in 3D space to the ground plane.
 * @param {Partial<Vector3>} [vector] - a 3D vector object with x, y, and z coordinates.
 * @returns {ScreenPosition} the equivalent 2D vector, where x is unchanged and resulting y is z.
 */
export function projectToGround({ x = 0, z = 0 } = {}) {
  return { x, y: z }
}

/**
 * Projects a 3D bounding box to the ground plane and return the corresponding rectangle.
 * @param {Partial<BoundingBox>} [box] - a 3D bounding box, with its minimumWorld and maximumWorld 3D points.
 * @returns {Rectangle} the corresponding rectangle projected to the ground plane.
 */
export function buildGroundRectangle({ minimumWorld, maximumWorld } = {}) {
  return {
    min: projectToGround(minimumWorld),
    max: projectToGround(maximumWorld)
  }
}

/**
 * Returns the biggest circle fully enclosed within the provided rectangle.
 * @param {Partial<Rectangle>} [rectangle] - a given 2D rectangle.
 * @returns {Circle} the enclosed 2D circle.
 */
export function buildEnclosedCircle({ min, max } = {}) {
  const height = ((max?.y ?? 0) - (min?.y ?? 0)) * 0.5
  const width = ((max?.x ?? 0) - (min?.x ?? 0)) * 0.5
  return {
    center: { x: (min?.x ?? 0) + width, y: (min?.y ?? 0) + height },
    radius: Math.min(height, width)
  }
}

/**
 * Tells whether 2 rectangles are intersecting or not.
 * @param {Rectangle} rectangleA - first rectangle.
 * @param {Rectangle} rectangleB - second rectangle.
 * @returns {boolean} true when these rectangles are intersecting with each other.
 */
export function intersectRectangles(
  { min: minA, max: maxA },
  { min: minB, max: maxB }
) {
  return (
    maxA.x >= minB.x && minA.x <= maxB.x && maxA.y >= minB.y && minA.y <= maxB.y
  )
}

/**
 * Tells whether 2 circles are intersecting or not.
 * @param {Circle} circleA - first circle.
 * @param {Circle} circleB - second circle.
 * @returns {boolean} true when these circles are intersecting with each other.
 */
export function intersectCircles(
  { center: centerA, radius: radiusA },
  { center: centerB, radius: radiusB }
) {
  return distance(centerA, centerB) <= radiusA + radiusB
}

/**
 * Tells whether a given rectangle intersects with a circle.
 * @param {Rectangle} rectangle - the checked rectangle.
 * @param {Circle} circle - the checked rectange.
 * @returns {boolean} true if the geometries intersects, false otherwise.
 */
export function intersectRectangleWithCircle({ min, max }, { center, radius }) {
  // inspired from https://www.geeksforgeeks.org/check-if-any-point-overlaps-the-given-circle-and-rectangle/
  return (
    distance(
      {
        x: Math.max(min.x, Math.min(center.x, max.x)),
        y: Math.max(min.y, Math.min(center.y, max.y))
      },
      center
    ) <= radius
  )
}
