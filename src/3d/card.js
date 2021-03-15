import Babylon from 'babylonjs'
import {
  DragBehavior,
  FlipBehavior,
  RotateBehavior,
  StackBehavior
} from './behaviors'
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
  y = 0,
  // Poker ratio is between 1.39 and 1.41
  width = 3,
  height = 4.25,
  front,
  back,
  isFlipped = false,
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
  faces[0].rotate(Axis.X, Math.PI / 2, Space.LOCAL)
  faces[1].material = new StandardMaterial('back')
  faces[1].material.diffuseTexture = new Texture(back)
  faces[1].rotate(Axis.X, Math.PI / -2, Space.LOCAL)
  faces[1].rotate(Axis.Z, Math.PI, Space.LOCAL)
  const card = Mesh.MergeMeshes(faces, true, false, null, false, true)
  card.receiveShadows = true
  card.position.set(x, 0, y)
  if (isFlipped) {
    card.rotation.z = Math.PI
  }
  Object.assign(card, cardProps)

  card.overlayColor = new Color3(0, 0.8, 0)
  card.overlayAlpha = 0.2

  const dragBehavior = new DragBehavior({ moveDuration, snapDistance })
  card.addBehavior(dragBehavior)

  const flipBehavior = new FlipBehavior({ duration: flipDuration, isFlipped })
  card.addBehavior(flipBehavior)

  const rotateBehavior = new RotateBehavior({ duration: rotateDuration })
  card.addBehavior(rotateBehavior)

  const stackBehavior = new StackBehavior({ moveDuration })
  const target = MeshBuilder.CreateBox('target', {
    width,
    height: 1,
    size: height
  })
  target.parent = card
  stackBehavior.defineTarget(target)
  card.addBehavior(stackBehavior)

  return card
}
