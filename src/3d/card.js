import {
  ActionManager,
  Animation,
  Axis,
  ExecuteCodeAction,
  Mesh,
  MeshBuilder,
  PointerDragBehavior,
  Space,
  StandardMaterial,
  Texture,
  Vector3
} from 'babylonjs'

export function createCard({
  x = 0,
  y = 0,
  width = 3,
  height = 4.12,
  front,
  back,
  flipDuration = 0.5
} = {}) {
  let isFlipped = false
  let isFlipping = false

  const faces = [
    MeshBuilder.CreatePlane('front-face', { width, height }),
    MeshBuilder.CreatePlane('back-face', { width, height })
  ]
  faces[0].material = new StandardMaterial('front')
  faces[0].material.diffuseTexture = new Texture(front)
  faces[0].rotate(Axis.X, Math.PI / 2, Space.LOCAL)
  faces[1].material = new StandardMaterial('back')
  faces[1].material.diffuseTexture = new Texture(back)
  faces[1].rotate(Axis.X, Math.PI / -2, Space.LOCAL)
  faces[1].rotate(Axis.Z, Math.PI, Space.LOCAL)
  const card = Mesh.MergeMeshes(faces, true, false, null, false, true)
  card.receiveShadows = true
  card.position.set(x, y, 0)

  const frameRate = 30
  const lastFrame = Math.round(frameRate * flipDuration)

  const flipAnimation = new Animation(
    'flip',
    'rotation.z',
    frameRate,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  )

  const raiseAnimation = new Animation(
    'raise',
    'position.y',
    frameRate,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  )

  function flip() {
    if (isFlipping) {
      return
    }
    flipAnimation.setKeys([
      { frame: 0, value: isFlipped ? Math.PI : 0 },
      { frame: lastFrame, value: isFlipped ? 0 : Math.PI }
    ])
    raiseAnimation.setKeys([
      { frame: 0, value: card.position.y },
      { frame: lastFrame * 0.5, value: card.position.y + width * 0.75 },
      { frame: lastFrame, value: card.position.y }
    ])
    drag.enabled = false
    isFlipping = true
    drag.releaseDrag()
    card
      .getScene()
      .beginDirectAnimation(
        card,
        [flipAnimation, raiseAnimation],
        0,
        frameRate,
        false,
        1,
        () => {
          drag.enabled = true
          isFlipping = false
          isFlipped = !isFlipped
        }
      )
  }

  card.actionManager = new ActionManager(card.getScene())
  card.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, flip)
  )

  const drag = new PointerDragBehavior({
    dragPlaneNormal: new Vector3(0, 1, 0)
  })
  drag.updateDragPlane = false
  drag.validateDrag = () => !isFlipping
  card.addBehavior(drag)

  let initialPos
  drag.onDragStartObservable.add(() => {
    initialPos = card.position.clone()
  })
  drag.onDragObservable.add(() => {
    // don't elevate if we're only holding the mouse button without moving
    if (Vector3.Distance(initialPos, card.position) > 0.02) {
      card.position.y = initialPos.y + 0.5
    }
  })
  drag.onDragEndObservable.add(() => {
    card.position.y = initialPos.y
  })

  return card
}
