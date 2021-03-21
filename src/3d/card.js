import Babylon from 'babylonjs'
import {
  DragBehavior,
  FlipBehavior,
  HoverBehavior,
  RotateBehavior,
  StackBehavior
} from './behaviors'
import { controlManager } from './managers'

const {
  Axis,
  Color3,
  Mesh,
  MeshBuilder,
  Space,
  StandardMaterial,
  Texture
} = Babylon

export function createCard({
  x = 0,
  z = 0,
  y = 0,
  // Poker ratio is between 1.39 and 1.41
  width = 3,
  height = 4.25,
  front,
  back,
  isFlipped = false,
  angle = 0,
  flipDuration = 0.5,
  rotateDuration = 0.2,
  moveDuration = 0.1,
  snapDistance = 0.25,
  ...cardProps
} = {}) {
  const faces = [
    MeshBuilder.CreatePlane('front-face', { width, height }),
    MeshBuilder.CreatePlane('back-face', { width, height })
  ]
  faces[0].material = new StandardMaterial('front')
  faces[0].material.diffuseTexture = new Texture(front)
  faces[0].material.diffuseTexture.hasAlpha = true
  faces[0].rotate(Axis.X, Math.PI / 2, Space.LOCAL)
  faces[1].material = new StandardMaterial('back')
  faces[1].material.diffuseTexture = new Texture(back)
  faces[1].material.diffuseTexture.hasAlpha = true
  faces[1].rotate(Axis.X, Math.PI / -2, Space.LOCAL)
  faces[1].rotate(Axis.Z, Math.PI, Space.LOCAL)
  const card = Mesh.MergeMeshes(faces, true, false, null, false, true)
  card.name = 'card'
  card.receiveShadows = true
  card.position.set(x, y, z)
  Object.assign(card, cardProps)

  card.metadata = {
    serialize: () => ({
      x: card.position.x,
      y: card.position.y,
      z: card.position.z,
      width,
      height,
      front,
      back,
      ...cardProps,
      ...flipBehavior.serialize(),
      ...rotateBehavior.serialize(),
      ...stackBehavior.serialize()
    })
  }

  card.overlayColor = new Color3(0, 0.8, 0)
  card.overlayAlpha = 0.2

  card.addBehavior(new DragBehavior({ moveDuration, snapDistance }))

  const flipBehavior = new FlipBehavior({ duration: flipDuration, isFlipped })
  card.addBehavior(flipBehavior)

  const rotateBehavior = new RotateBehavior({ duration: rotateDuration, angle })
  card.addBehavior(rotateBehavior)

  card.addBehavior(new HoverBehavior())

  const stackBehavior = new StackBehavior({ moveDuration })
  const target = MeshBuilder.CreateBox('target', {
    width,
    height: 1,
    size: height
  })
  target.parent = card
  stackBehavior.defineTarget(target)
  card.addBehavior(stackBehavior)

  controlManager.registerControlable(card)
  card.onDisposeObservable.addOnce(() =>
    controlManager.unregisterControlable(card)
  )
  return card
}
