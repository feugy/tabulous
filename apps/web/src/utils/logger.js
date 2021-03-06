const levels = {
  anchorable: 'warn',
  camera: 'warn',
  catalog: 'warn',
  'custom-shape': 'warn',
  flippable: 'warn',
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
  quantifiable: 'warn',
  rotable: 'warn',
  selection: 'warn',
  'scene-loader': 'warn',
  stackable: 'warn',
  stream: 'warn',
  target: 'warn'
}

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

const loggers = new Map()

function noop() {}

function getImplementation(name, level) {
  return levelMap[level] <= levelMap[levels[name] || 'info']
    ? console[level].bind(console)
    : noop
}

export function makeLogger(name) {
  if (!loggers.has(name)) {
    loggers.set(name, {
      trace: getImplementation(name, 'trace'),
      debug: getImplementation(name, 'log'),
      log: getImplementation(name, 'log'),
      info: getImplementation(name, 'info'),
      warn: getImplementation(name, 'warn'),
      error: getImplementation(name, 'error')
    })
  }
  return loggers.get(name)
}
