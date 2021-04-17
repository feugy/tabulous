function addToLevel(tool, level, legs) {
  const leg = legs.shift()
  let items = level.get(leg)
  if (legs.length === 0) {
    level.set(leg, tool)
  } else {
    if (!items) {
      // TODO what if an existing leaf is found with same name as node?
      // - Components/Discussion
      // - Components/Discussion/some stuff
      items = new Map()
      level.set(leg, items)
    }
    addToLevel(tool, items, legs)
  }
}

export function groupByName(tools) {
  const level = new Map()
  for (const tool of tools) {
    const legs = tool.name.split('/')
    addToLevel(tool, level, legs)
  }
  return level
}
