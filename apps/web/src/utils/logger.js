// @ts-check
/** @typedef {'trace'|'debug'|'log'|'info'|'warn'|'error'} Level */
/** @typedef {Level|'all'|'silent'} LevelWithOnOff */
/** @typedef {typeof console.log} Log */
/**
 * @typedef {object} Logger
 * @property {Log} trace
 * @property {Log} debug
 * @property {Log} log
 * @property {Log} info
 * @property {Log} warn
 * @property {Log} error
 */

/** @type {Record<string, LevelWithOnOff>} */
const levels = {
  animatable: 'warn',
  anchorable: 'warn',
  camera: 'warn',
  catalog: 'warn',
  'custom-shape': 'warn',
  flippable: 'warn',
  friends: 'warn',
  'game-interaction': 'warn',
  'game-manager': 'warn',
  graphql: 'warn',
  gravity: 'warn',
  hand: 'warn',
  input: 'warn',
  indicator: 'warn',
  lockable: 'warn',
  material: 'warn',
  move: 'warn',
  players: 'warn',
  'peer-channels': 'warn',
  'peer-connection': 'warn',
  quantifiable: 'warn',
  randomizable: 'warn',
  replay: 'warn',
  rotable: 'warn',
  selection: 'warn',
  'scene-loader': 'warn',
  stackable: 'warn',
  stream: 'warn',
  target: 'warn'
}

/** @type {Record<LevelWithOnOff, number>} */
const levelMap = {
  all: 6,
  trace: 5,
  debug: 4,
  log: 4,
  info: 3,
  warn: 2,
  error: 1,
  silent: 0
}

/** @type {Map<string, Logger>} */
const loggers = new Map()

function noop() {}

/**
 * @param {string} name - logger name.
 * @param {Level} level - desired level.
 * @returns {Log} implementation for this logger and level.
 */
function getImplementation(name, level) {
  return (...args) =>
    levelMap[level] <= levelMap[levels[name] || 'info']
      ? console[level](...args)
      : noop
}

/**
 * Creates (or reused cached) logger, with a default level of 'info' (if not specified already).
 * @param {string} name - desired logger name.
 * @returns {Logger} the built (or cached) logger.
 */
export function makeLogger(name) {
  if (!loggers.has(name)) {
    loggers.set(name, {
      trace: getImplementation(name, 'log'),
      debug: getImplementation(name, 'log'),
      log: getImplementation(name, 'log'),
      info: getImplementation(name, 'info'),
      warn: getImplementation(name, 'warn'),
      error: getImplementation(name, 'error')
    })
  }
  return /** @type {Logger} */ (loggers.get(name))
}

/**
 * Allows changing logger levels at runtime.
 * Performs basic validation to avoid setting unknown loggers, or configuring unsupported level.
 * @param {Record<string, LevelWithOnOff>|LevelWithOnOff} newLevels - partial logger level map, merged into the current map, or same level for all loggers.
 * @returns {Record<string, LevelWithOnOff>} the new, merged logger level map.
 */
globalThis.configureLoggers = function (newLevels) {
  if (typeof newLevels !== 'object') {
    if (!(newLevels in levelMap)) {
      console.warn(`ignoring unknown logger ${newLevels}`)
    } else {
      for (const logger in levels) {
        levels[logger] = newLevels
      }
    }
    return levels
  }
  for (const logger in newLevels) {
    if (!(logger in levels)) {
      console.warn(`ignoring unknown logger ${logger}`)
      // @ts-expect-error undefined is not assignable to LevelWithOnOff
      newLevels[logger] = undefined
    } else if (!(newLevels[logger] in levelMap)) {
      console.warn(`ignoring unknown level for ${logger}: ${newLevels[logger]}`)
      // @ts-expect-error undefined is not assignable to LevelWithOnOff
      newLevels[logger] = undefined
    }
  }
  return Object.assign(levels, newLevels)
}
