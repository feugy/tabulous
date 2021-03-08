const renderers = []
let id

function runLoop() {
  for (const render of renderers) {
    try {
      render()
    } catch (err) {
      // ignore errors for now
      console.warn(err)
    }
  }
  id = requestAnimationFrame(runLoop)
}

export function registerRenderer(renderer) {
  if (!renderers.includes(renderer)) {
    renderers.push(renderer)
  }
}

export function unregisterRenderer(renderer) {
  const idx = renderers.indexOf(renderer)
  if (idx >= 0) {
    renderers.splice(idx, 1)
  }
}

export function startLoop() {
  runLoop()
}

export function stopLoop() {
  cancelAnimationFrame(id)
  id = null
}
