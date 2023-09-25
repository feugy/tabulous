/**
 * @typedef {object} Managers
 * @property {import('@src/3d/managers/camera').CameraManager} camera
 * @property {import('@src/3d/managers/control').ControlManager} control
 * @property {import('@src/3d/managers/custom-shape').CustomShapeManager} customShape
 * @property {import('@src/3d/managers/hand').HandManager} hand
 * @property {import('@src/3d/managers/indicator').IndicatorManager} indicator
 * @property {import('@src/3d/managers/input').InputManager} input
 * @property {import('@src/3d/managers/material').MaterialManager} material
 * @property {import('@src/3d/managers/move').MoveManager} move
 * @property {import('@src/3d/managers/replay').ReplayManager} replay
 * @property {import('@src/3d/managers/selection').SelectionManager} selection
 * @property {import('@src/3d/managers/target').TargetManager} target
 */
export * from './camera'
export * from './control'
export * from './custom-shape'
export * from './hand'
export * from './indicator'
export * from './input'
export * from './material'
export * from './move'
export * from './replay'
export * from './selection'
export * from './target'
