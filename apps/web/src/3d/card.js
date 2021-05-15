import {
  Axis,
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Vector3,
  Vector4
} from '@babylonjs/core'
import {
  DragBehavior,
  FlipBehavior,
  HoverBehavior,
  RotateBehavior,
  StackBehavior
} from './behaviors'
import { controlManager } from './managers'

export function createCard({
  x = 0,
  z = 0,
  y = 0,
  // Poker ratio is between 1.39 and 1.41
  width = 3,
  height = 4.25,
  depth = 0.01,
  texture,
  isFlipped = false,
  angle = 0,
  flipDuration = 0.5,
  rotateDuration = 0.2,
  moveDuration = 0.1,
  snapDistance = 0.25,
  ...cardProps
} = {}) {
  const faces = MeshBuilder.CreatePlane('faces', {
    width,
    height,
    frontUVs: new Vector4(1, 1, 0.5, 0),
    backUVs: new Vector4(0, 1, 0.5, 0),
    sideOrientation: Mesh.DOUBLESIDE
  })
  faces.material = new StandardMaterial('faces')
  faces.material.diffuseTexture = new Texture(texture)
  faces.material.diffuseTexture.hasAlpha = true
  faces.material.freeze()

  const card = MeshBuilder.CreateBox('card', {
    width,
    height: depth,
    depth: height
  })

  // because planes are in 2-D, collisions with other meshes could be tricky.
  // wraps the plane with an invisible box. Box will take picks
  card.visibility = 0
  faces.rotate(Axis.X, Math.PI * 0.5)
  faces.position.y += depth * 0.5
  faces.isPickable = false
  faces.parent = card

  card.receiveShadows = true
  card.setAbsolutePosition(new Vector3(x, y, z))
  Object.assign(card, cardProps)

  card.metadata = {
    serialize: () => ({
      x: card.position.x,
      y: card.position.y,
      z: card.position.z,
      width,
      height,
      depth,
      texture,
      ...cardProps,
      ...flipBehavior.serialize(),
      ...rotateBehavior.serialize(),
      ...stackBehavior.serialize()
    })
  }

  faces.overlayColor = new Color3(0, 0.8, 0)
  faces.overlayAlpha = 0.2
  Object.defineProperty(card, 'renderOverlay', {
    get() {
      return faces.renderOverlay
    },
    set(value) {
      faces.renderOverlay = value
    }
  })

  const dragKind = 'card'
  card.addBehavior(
    new DragBehavior({ moveDuration, snapDistance, dragKind }),
    true
  )

  const flipBehavior = new FlipBehavior({ duration: flipDuration, isFlipped })
  card.addBehavior(flipBehavior, true)

  const rotateBehavior = new RotateBehavior({ duration: rotateDuration, angle })
  card.addBehavior(rotateBehavior, true)

  card.addBehavior(new HoverBehavior(), true)

  const stackBehavior = new StackBehavior({ moveDuration })
  const target = MeshBuilder.CreateBox('drop-target', {
    width,
    height: depth + 0.01,
    depth: height
  })
  target.parent = card
  stackBehavior.defineTarget(target, 0.3, [dragKind])
  card.addBehavior(stackBehavior, true)

  controlManager.registerControlable(card)
  card.onDisposeObservable.addOnce(() =>
    controlManager.unregisterControlable(card)
  )
  return card
}
