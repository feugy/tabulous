const levels = {
  communication: 'warn',
  draggable: 'info',
  flippable: 'info',
  gravity: 'info',
  'multi-selection': 'info',
  rotable: 'info',
  'scene-loader': 'info',
  stackable: 'info'
}

const levelMap = {
  all: 6,
  trace: 6,
  debug: 5,
  log: 4,
  info: 3,
  warn: 2,
  error: 1,
  silent: 0
}

const loggers = new Map()

function noop() {}

function getImplementation(name, level) {
  return levelMap[level] <= levelMap[levels[name] || 'warn']
    ? console[level].bind(console)
    : noop
}

export function makeLogger(name) {
  if (!loggers.has(name)) {
    loggers.set(name, {
      trace: getImplementation(name, 'trace'),
      debug: getImplementation(name, 'debug'),
      log: getImplementation(name, 'log'),
      info: getImplementation(name, 'info'),
      warn: getImplementation(name, 'warn'),
      error: getImplementation(name, 'error')
    })
  }
  return loggers.get(name)
}
