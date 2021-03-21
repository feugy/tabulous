import Babylon from 'babylonjs'
import { Subject } from 'rxjs'
import { controlManager, dragManager, multiSelectionManager } from './managers'
const { Engine, Scene } = Babylon

export function createEngine({ canvas } = {}) {
  const engine = new Engine(canvas, true)

  const scene = new Scene(engine)

  dragManager.init({ scene })
  multiSelectionManager.init({ scene })

  engine.start = () => engine.runRenderLoop(scene.render.bind(scene))

  engine.applyAction = controlManager.apply.bind(controlManager)
  engine.movePeerPointer = controlManager.movePeerPointer.bind(controlManager)

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
    { observable: engine.onEndFrameObservable, subjectName: 'onFrameEnd' },
    { observable: controlManager.onActionObservable, subjectName: 'onAction' },
    { observable: controlManager.onPointerObservable, subjectName: 'onPointer' }
  ]

  // expose Babylon observables as RX subjects
  for (const { observable, subjectName } of mapping) {
    engine[subjectName] = new Subject()
    mapping.observer = observable.add(
      engine[subjectName].next.bind(engine[subjectName])
    )
  }

  function handlePointerOut(event) {
    console.log('OUT')
    multiSelectionManager.cancel(event)
    dragManager.cancel(event)
  }

  canvas.addEventListener('pointerout', handlePointerOut)
  // engine.onDisposeObservable.add(() => {
  //   for (const { observable, subjectName, observer } of mapping) {
  //     engine[subjectName].unsubscribe()
  //     observable.remove(observer)
  //   }
  //   cancas.removeEventListener('mouseleave', handlePointerOut)
  // })
  return engine
}
