import Babylon from 'babylonjs'
import { screenToGround } from './behaviors/utils'
const {
  Engine,
  MeshBuilder,
  Observable,
  PointerEventTypes,
  Scene,
  Vector3
} = Babylon

export function createEngine({ canvas, interaction } = {}) {
  const engine = new Engine(canvas, true)
  engine.inputElement = interaction

  const scene = new Scene(engine)

  scene.onSelectionActiveObservable = new Observable()
  scene.onSelectionResetObservable = new Observable()
  scene.selection = { start: null, stop: null, meshes: [] }
  let selectionBox = null
  let pointerDown = false

  scene.onPrePointerObservable.add(info => {
    const { type, event, localPosition } = info
    if (type === PointerEventTypes.POINTERDOWN) {
      pointerDown = true
      if (scene.selection.meshes.length) {
        let hit = scene.pickWithRay(
          scene.createPickingRay(localPosition.x, localPosition.y)
        )
        if (!hit || !scene.selection.meshes.includes(hit.pickedMesh)) {
          scene.onSelectionResetObservable.notifyObservers()
          scene.selection.start = null
          scene.selection.stop = null
          for (const mesh of scene.selection.meshes) {
            mesh.renderOverlay = false
          }
          scene.selection.meshes = []
        }
      }
    } else if (type === PointerEventTypes.POINTERMOVE && event.shiftKey) {
      if (pointerDown && !scene.selection.start) {
        // detects a multiple selection operation.
        // create a box to vizualise selected area
        scene.selection.start = screenToGround(scene, localPosition)
        selectionBox = MeshBuilder.CreateBox('multi-selection', { size: 0 })
        selectionBox.visibility = 0.2
        selectionBox.isPickable = false
        selectionBox.position = scene.selection.start
        scene.selection.meshes = []
      }
      if (scene.selection.start) {
        // updates size and position of the multiple selection box.
        // its position is the center of operation start and current position, then we scale it
        info.skipOnPointerObservable = true
        const { x: xA, z: zA } = scene.selection.start
        const { x: xB, z: zB } = screenToGround(scene, localPosition)
        selectionBox.position = new Vector3((xA + xB) * 0.5, 0, (zA + zB) * 0.5)
        selectionBox.scaling = new Vector3(
          Math.abs(xB - xA),
          1,
          Math.abs(zB - zA)
        )
      }
    } else if (type === PointerEventTypes.POINTERUP) {
      pointerDown = false
      if (scene.selection.start) {
        // end of a multiple selection: find selected meshes
        for (const mesh of scene.meshes) {
          if (mesh.isPickable && selectionBox.intersectsMesh(mesh)) {
            scene.selection.meshes.push(mesh)
            mesh.renderOverlay = true
          }
        }
        selectionBox?.dispose()
        scene.selection.stop = screenToGround(scene, localPosition)
        scene.onSelectionActiveObservable.notifyObservers()
      }
    }
  })

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
