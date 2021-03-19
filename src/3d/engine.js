import Babylon from 'babylonjs'
import { Subject } from 'rxjs'
import { dragManager, multiSelectionManager } from './managers'
const { Engine, Scene } = Babylon

export function createEngine({ canvas, interaction } = {}) {
  const engine = new Engine(canvas, true)
  engine.inputElement = interaction

  const scene = new Scene(engine)

  dragManager.init({ scene })
  multiSelectionManager.init({ scene })

  engine.start = () => engine.runRenderLoop(scene.render.bind(scene))

  const mapping = [
    {
      observable: multiSelectionManager.onOverObservable,
      subjectName: 'onPointerOver'
    },
    {
      observable: multiSelectionManager.onOutObservable,
      subjectName: 'onPointerOut'
    },
    {
      observable: multiSelectionManager.onSelectionActiveObservable,
      subjectName: 'onSelectionActive'
    },
    {
      observable: multiSelectionManager.onSelectionResetObservable,
      subjectName: 'onSelectionReset'
    },
    {
      observable: dragManager.onDragStartObservable,
      subjectName: 'onDragStart'
    },
    { observable: dragManager.onDragObservable, subjectName: 'onDrag' },
    { observable: dragManager.onDragEndObservable, subjectName: 'onDragEnd' },
    { observable: engine.onEndFrameObservable, subjectName: 'onFrameEnd' }
  ]

  // expose Babylon observables as RX subjects
  for (const { observable, subjectName } of mapping) {
    engine[subjectName] = new Subject()
    mapping.observer = observable.add(
      engine[subjectName].next.bind(engine[subjectName])
    )
  }
  // engine.onDisposeObservable.add(() => {
  //   for (const { observable, subjectName, observer } of mapping) {
  //     engine[subjectName].unsubscribe()
  //     observable.remove(observer)
  //   }
  // })
  return engine
}
