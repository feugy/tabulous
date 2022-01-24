import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import {
  computeYAbove,
  applyGravity,
  getHeight,
  isAbove,
  sortByElevation
} from '../../../src/3d/utils'
import { configures3dTestEngine } from '../../test-utils'

configures3dTestEngine()

describe('sortByElevation() 3D utility', () => {
  let boxes = []

  beforeEach(() => {
    boxes = []
    boxes.push(CreateBox('box', {}))
    boxes[boxes.length - 1].absolutePosition.y = 10
    boxes.push(CreateBox('box2', {}))
    boxes[boxes.length - 1].absolutePosition.y = 0
    boxes.push(CreateBox('box3', {}))
    boxes[boxes.length - 1].absolutePosition.y = -5
    boxes.push(CreateBox('box4', {}))
    boxes[boxes.length - 1].absolutePosition.y = 7
  })

  it('returns lowest mesh first', () => {
    expect(sortByElevation(boxes)).toEqual([
      boxes[2],
      boxes[1],
      boxes[3],
      boxes[0]
    ])
  })

  it('returns highest mesh first', () => {
    expect(sortByElevation(boxes, true)).toEqual([
      boxes[0],
      boxes[3],
      boxes[1],
      boxes[2]
    ])
  })

  it('handles no input', () => {
    expect(sortByElevation()).toEqual([])
  })
})

describe('applyGravity() 3D utility', () => {
  const x = faker.datatype.number()
  const z = faker.datatype.number()

  it('positions mesh on the ground', () => {
    const box = CreateBox('box', {})
    expect(getHeight(box)).toEqual(1)
    box.setAbsolutePosition(new Vector3(x, 10, z))
    box.computeWorldMatrix()
    const box2 = CreateBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x + 2, 3, z))
    box2.computeWorldMatrix()
    expect(box.absolutePosition.y).toEqual(10)
    expect(applyGravity(box).asArray()).toEqual([x, 0.5, z])
  })

  it('positions mesh with negative position', () => {
    const box = CreateBox('box', {})
    expect(getHeight(box)).toEqual(1)
    box.setAbsolutePosition(new Vector3(x, -10, z))
    box.computeWorldMatrix()
    const box2 = CreateBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x, 3, z - 2))
    box2.computeWorldMatrix()
    expect(box.absolutePosition.y).toEqual(-10)
    expect(applyGravity(box).asArray()).toEqual([x, 0.5, z])
  })

  it('positions mesh just above another one', () => {
    const box = CreateBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 15, z))
    box.computeWorldMatrix()
    const box2 = CreateBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x, 3, z))
    box2.computeWorldMatrix()
    let pos = applyGravity(box)
    expect(pos.x).toEqual(x)
    expect(pos.y).toBeCloseTo(4)
    expect(pos.z).toEqual(z)
  })

  it('positions mesh above another one with partial overlap', () => {
    const box = CreateBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 10, z))
    box.computeWorldMatrix()
    const box2 = CreateBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x - 0.5, 2, z - 0.5))
    box2.computeWorldMatrix()
    let pos = applyGravity(box)
    expect(pos.x).toEqual(x)
    expect(pos.y).toBeCloseTo(3)
    expect(pos.z).toEqual(z)
  })

  it('positions mesh just above several ones', () => {
    const box = CreateBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 20, z))
    box.computeWorldMatrix()
    const box2 = CreateBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x - 0.5, 4, z))
    box2.computeWorldMatrix()
    const box3 = CreateBox('box3', {})
    box3.setAbsolutePosition(new Vector3(x + 0.5, 3, z))
    box3.computeWorldMatrix()
    let pos = applyGravity(box)
    expect(pos.x).toEqual(x)
    expect(pos.y).toBeCloseTo(5)
    expect(pos.z).toEqual(z)
  })
})

describe('isAbove() 3D utility', () => {
  const x = faker.datatype.number()
  const z = faker.datatype.number()

  it('finds when a mesh is hovering another one', () => {
    const box = CreateBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 20, z))
    box.computeWorldMatrix()
    const box2 = CreateBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x - 0.5, 4, z))
    box2.computeWorldMatrix()

    expect(isAbove(box, box2)).toBe(true)
  })

  it('finds when a mesh is not hovering another one', () => {
    const box = CreateBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 20, z))
    box.computeWorldMatrix()
    const box2 = CreateBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x - 3, 4, z))
    box2.computeWorldMatrix()

    expect(isAbove(box, box2)).toBe(false)
  })

  it('applies scaling when detecting hovered mesh', () => {
    const box = CreateBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 20, z))
    box.computeWorldMatrix()
    const box2 = CreateBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x - 1, 4, z))
    box2.computeWorldMatrix()

    expect(isAbove(box, box2, 3)).toBe(true)
    expect(isAbove(box, box2, 1.5)).toBe(false)
  })
})

describe('computeYAbove() 3D utility', () => {
  it('considers heights when positioning mesh above another one (without fresh matrix)', () => {
    const box = CreateBox('box', { height: 4 })
    box.absolutePosition.y = 20
    const box2 = CreateBox('box2', { height: 3 })
    expect(computeYAbove(box2, box)).toEqual(20 + 4 / 2 + 3 / 2 + 0.001)
  })
})

// TODO rotations
