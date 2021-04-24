import { Ray, Vector3 } from '@babylonjs/core'
import { getHeight } from './mesh'
import { makeLogger } from '../../utils'

const logger = makeLogger('gravity')

const rayLength = 30
const down = Vector3.Down()

function findBellow(mesh, predicate) {
  const over = new Map()
  const { boundingBox } = mesh.getBoundingInfo()

  const vertices = [mesh.absolutePosition]
  for (const vertex of boundingBox.vectorsWorld) {
    if (vertex.y <= vertices[0].y) {
      vertices.push(vertex)
    }
  }

  const scene = mesh.getScene()
  for (const vertex of vertices) {
    const hit = scene.pickWithRay(new Ray(vertex, down, rayLength), predicate)
    if (hit.pickedMesh) {
      const count = over.get(hit.pickedMesh) || 0
      over.set(hit.pickedMesh, count + 1)
    }
  }
  return over
}

export function altitudeOnTop(mesh, other) {
  return other.absolutePosition.y + getHeight(other) + getHeight(mesh) + 0.001
}

export function applyGravity(mesh) {
  logger.debug(
    { y: mesh.absolutePosition.y, mesh },
    `gravity for ${mesh.id} y: ${mesh.absolutePosition.y}`
  )
  mesh.computeWorldMatrix(true)
  const over = findBellow(mesh, other => other.isPickable && other !== mesh)
  let y = getHeight(mesh)
  if (over.size) {
    const ordered = [...over.keys()].sort(
      (a, b) => b.absolutePosition.y - a.absolutePosition.y
    )
    y = altitudeOnTop(mesh, ordered[0])
    logger.debug(
      { ordered, mesh },
      `${mesh.id} is above ${ordered.map(({ id }) => id)}`
    )
  }
  logger.debug({ y, mesh }, `${mesh.id} assigned to y: ${y}`)
  const { x, z } = mesh.absolutePosition
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.computeWorldMatrix(true)
  return mesh.absolutePosition
}

export function isAbove(mesh, target, scale) {
  const originalScale = target.scaling.clone()
  target.scaling.addInPlace(new Vector3(scale, scale, scale))
  target.computeWorldMatrix()

  const over = findBellow(mesh, other => other === target)
  target.scaling.copyFrom(originalScale)
  target.computeWorldMatrix()
  return over.get(target) >= 4
}