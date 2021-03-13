import Babylon from 'babylonjs'
import { dragManager, multiSelectionManager } from './managers'
const { Engine, Scene } = Babylon

export function createEngine({ canvas, interaction } = {}) {
  const engine = new Engine(canvas, true)
  engine.inputElement = interaction

  const scene = new Scene(engine)

  dragManager.init({ scene })
  multiSelectionManager.init({ scene })

  return {
    start() {
      engine.runRenderLoop(scene.render.bind(scene))
    },
    resize() {
      engine.resize()
    },
    dispose() {
      engine.dispose()
    }
  }
}
