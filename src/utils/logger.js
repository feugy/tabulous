const levels = {
  draggable: 'info',
  flippable: 'info',
  gravity: 'info',
  'multi-selection': 'info',
  rotable: 'info',
  stackable: 'debug'
}

const levelMap = {
  all: 5,
  trace: 5,
  debug: 4,
  log: 3,
  info: 3,
  warn: 2,
  error: 1,
  silent: 0
}

const loggers = new Map()

function noop() {}

function getImplementation(name, level) {
  return levelMap[levels[name] || 'warn'] >= levelMap[level]
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
