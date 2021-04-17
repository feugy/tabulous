import {
  Color3,
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

export function createRoundToken({
  x = 0,
  y = 0.05,
  z = 0,
  diameter = 2,
  height = 0.1,
  texture,
  isFlipped = false,
  angle = 0,
  flipDuration = 0.5,
  rotateDuration = 0.2,
  moveDuration = 0.1,
  snapDistance = 0.25,
  ...tokenProps
} = {}) {
  const faceUV = [
    new Vector4(0, 0, 0.49, 1),
    new Vector4(0.49, 1, 0.509, 0),
    new Vector4(0.509, 0, 1, 1)
  ]
  const token = MeshBuilder.CreateCylinder('round-token', {
    diameter,
    height,
    tessellation: 48,
    faceUV
  })
  token.material = new StandardMaterial('round-token')
  token.material.diffuseTexture = new Texture(texture)
  token.material.diffuseTexture.hasAlpha = true
  token.material.freeze()

  token.receiveShadows = true
  token.setAbsolutePosition(new Vector3(x, y, z))
  Object.assign(token, tokenProps)

  token.metadata = {
    serialize: () => ({
      x: token.position.x,
      y: token.position.y,
      z: token.position.z,
      texture,
      diameter,
      height,
      ...tokenProps,
      ...flipBehavior.serialize(),
      ...rotateBehavior.serialize(),
      ...stackBehavior.serialize()
    })
  }

  token.overlayColor = new Color3(0, 0.8, 0)
  token.overlayAlpha = 0.2

  const dragKind = 'round-target'
  token.addBehavior(
    new DragBehavior({ moveDuration, snapDistance, dragKind }),
    true
  )

  const flipBehavior = new FlipBehavior({ duration: flipDuration, isFlipped })
  token.addBehavior(flipBehavior, true)

  const rotateBehavior = new RotateBehavior({ duration: rotateDuration, angle })
  token.addBehavior(rotateBehavior, true)

  token.addBehavior(new HoverBehavior(), true)

  const stackBehavior = new StackBehavior({ moveDuration })
  const target = MeshBuilder.CreateCylinder('drop-target', {
    diameter,
    height: height + 0.02
  })
  target.parent = token
  stackBehavior.defineTarget(target, 0.6, [dragKind])
  token.addBehavior(stackBehavior, true)

  controlManager.registerControlable(token)
  token.onDisposeObservable.addOnce(() =>
    controlManager.unregisterControlable(token)
  )
  return token
}
