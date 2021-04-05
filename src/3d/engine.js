import { Engine, Scene } from '@babylonjs/core'
import { dragManager, multiSelectionManager } from './managers'

export function createEngine({ canvas, interaction } = {}) {
  const engine = new Engine(canvas, true)
  engine.inputElement = interaction

  const scene = new Scene(engine)

  dragManager.init({ scene })
  multiSelectionManager.init({ scene })

  engine.start = () => engine.runRenderLoop(scene.render.bind(scene))

  function handlePointerOut(event) {
    multiSelectionManager.cancel(event)
    dragManager.cancel(event)
  }

  interaction.addEventListener('pointerleave', handlePointerOut)
  engine.onDisposeObservable.addOnce(() => {
    canvas.removeEventListener('pointerleave', handlePointerOut)
  })
  return engine
}
