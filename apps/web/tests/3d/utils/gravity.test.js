// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  altitudeGap,
  applyGravity,
  getCenterAltitudeAbove,
  getDimensions,
  isAbove,
  sortByElevation
} from '@src/3d/utils'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  createCylinder,
  expectCloseVector
} from '../../test-utils'

configures3dTestEngine()

describe('sortByElevation() 3D utility', () => {
  /** @type {Mesh[]} */
  let boxes = []

  beforeEach(() => {
    boxes = []
    boxes.push(createBox('box', {}))
    boxes[boxes.length - 1].absolutePosition.y = 10
    boxes.push(createBox('box2', {}))
    boxes[boxes.length - 1].absolutePosition.y = 0
    boxes.push(createBox('box3', {}))
    boxes[boxes.length - 1].absolutePosition.y = -5
    boxes.push(createBox('box4', {}))
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
  const x = faker.number.int(999)
  const z = faker.number.int(999)

  it('positions mesh on the ground', () => {
    const box = createBox('box', {})
    expect(getDimensions(box).height).toEqual(1)
    box.setAbsolutePosition(new Vector3(x, 10, z))
    const box2 = createBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x + 2, 3, z))
    expect(box.absolutePosition.y).toEqual(10)
    expectCloseVector(applyGravity(box), [x, 0.5, z])
  })

  it('positions mesh with negative position', () => {
    const box = createBox('box', {})
    expect(getDimensions(box).height).toEqual(1)
    box.setAbsolutePosition(new Vector3(x, -10, z))
    const box2 = createBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x, 3, z - 2))
    expect(box.absolutePosition.y).toEqual(-10)
    expectCloseVector(applyGravity(box), [x, 0.5, z])
  })

  it('positions mesh just above another one', () => {
    const box = createBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 15, z))
    const box2 = createBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x, 3, z))
    expectCloseVector(applyGravity(box), [x, 4 + altitudeGap, z])
  })

  it('positions mesh above another one with partial overlap', () => {
    const box = createBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 10, z))
    const box2 = createBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x - 0.5, 2, z - 0.5))
    expectCloseVector(applyGravity(box), [x, 3 + altitudeGap, z])
  })

  it('positions mesh just above several ones', () => {
    const box = createBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 20, z))
    const box2 = createBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x - 0.5, 4, z))
    const box3 = createBox('box3', {})
    box3.setAbsolutePosition(new Vector3(x + 0.5, 3, z))
    expectCloseVector(applyGravity(box), [x, 5 + altitudeGap, z])
  })
})

describe('isAbove() 3D utility', () => {
  const x = faker.number.int({ min: -10, max: 10 })
  const z = faker.number.int({ min: -10, max: 10 })

  it('finds when a mesh is hovering another one', () => {
    const box = createBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 20, z))
    const box2 = createBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x - 0.5, 4, z))

    expect(isAbove(box, box2)).toBe(true)
  })

  it('finds when a mesh is not hovering another one', () => {
    const box = createBox('box', {})
    box.setAbsolutePosition(new Vector3(x, 20, z))
    const box2 = createBox('box2', {})
    box2.setAbsolutePosition(new Vector3(x - 3, 4, z))

    expect(isAbove(box, box2)).toBe(false)
  })

  describe.each([
    {
      title: 'two intersecting squares',
      buildMeshes: () =>
        [2, 3].map((size, i) =>
          createBox(`box${i + 1}`, { width: size, depth: size })
        ),
      results: [true, true]
    },
    {
      title: 'two intersecting rectangles',
      buildMeshes: () => [
        createBox(`box1`, { width: 2, depth: 4 }),
        createBox(`box2`, { width: 3, depth: 1 })
      ],
      results: [true, true]
    },
    {
      title: 'two cylinders',
      buildMeshes: () =>
        [
          createCylinder(`cylinder1`, { diameter: 2 }),
          createCylinder(`cylinder2`, { diameter: 3 })
        ].map(mesh => {
          mesh.isCylindric = true
          return mesh
        }),
      results: [true, false]
    },
    {
      title: 'two hexagons',
      buildMeshes: () =>
        [
          createCylinder(`hexgon1`, { tessellation: 6, diameter: 2 }),
          createCylinder(`hexgon3`, { tessellation: 6, diameter: 3 })
        ].map(mesh => {
          mesh.isCylindric = true
          return mesh
        }),
      results: [true, false]
    },
    {
      title: 'a cylinder and an hexagon',
      buildMeshes: () =>
        [
          createCylinder(`hexgon1`, { tessellation: 6, diameter: 2 }),
          createCylinder(`cylinder2`, { diameter: 3 })
        ].map(mesh => {
          mesh.isCylindric = true
          return mesh
        }),
      results: [true, false]
    },
    {
      title: 'a cylinder and a square',
      buildMeshes: () =>
        [
          createBox(`box1`, { width: 2, depth: 2 }),
          createCylinder(`cylinder2`, { diameter: 2.5 })
        ].map((mesh, i) => {
          mesh.isCylindric = i === 1
          return mesh
        }),
      results: [true, false]
    },
    {
      title: 'a cylinder and a rectangle',
      buildMeshes: () =>
        [
          createBox(`box1`, { width: 3, depth: 2 }),
          createCylinder(`cylinder2`, { diameter: 2 })
        ].map((mesh, i) => {
          mesh.isCylindric = i === 1
          return mesh
        }),
      results: [true, false]
    },
    {
      title: 'a hexagon and a rectangle',
      buildMeshes: () =>
        [
          createBox(`box1`, { width: 3, depth: 2 }),
          createCylinder(`hexagon2`, { tessellation: 6, diameter: 2 })
        ].map((mesh, i) => {
          mesh.isCylindric = i === 1
          return mesh
        }),
      results: [true, false]
    },
    {
      title: 'rectangles of the same size',
      buildMeshes: () => [
        createBox(`box1`, { width: 2, depth: 2 }),
        createBox(`box2`, { width: 2, depth: 2 })
      ],
      results: [true, true]
    }
  ])(`given $title`, ({ buildMeshes, results }) => {
    /** @type {Mesh[]} */
    let meshes
    beforeEach(() => {
      meshes = buildMeshes()
    })

    it('detects overlap on edge', () => {
      setPosition([
        { mesh: meshes[0], x, y: 10, z },
        { mesh: meshes[1], x: x - 2, y: 0, z }
      ])
      expect(isAbove(meshes[0], meshes[1])).toBe(results[0])
      setPosition([
        { mesh: meshes[1], x: x - 2, y: 10, z },
        { mesh: meshes[0], x, y: 0, z }
      ])
      expect(isAbove(meshes[1], meshes[0])).toBe(results[0])
    })

    it('detects overlap on corner', () => {
      setPosition([
        { mesh: meshes[0], x, y: 10, z },
        { mesh: meshes[1], x: x - 2, y: 0, z: z - 2 }
      ])
      expect(isAbove(meshes[0], meshes[1])).toBe(results[1])
      setPosition([
        { mesh: meshes[1], x: x - 2, y: 10, z: z - 2 },
        { mesh: meshes[0], x, y: 0, z }
      ])
      expect(isAbove(meshes[1], meshes[0])).toBe(results[1])
    })

    it('detects overlap above', () => {
      setPosition([
        { mesh: meshes[0], x, y: 10, z },
        { mesh: meshes[1], x, y: 0, z }
      ])
      expect(isAbove(meshes[0], meshes[1])).toBe(true)
      setPosition([
        { mesh: meshes[1], x, y: 10, z },
        { mesh: meshes[0], x, y: 0, z }
      ])
      expect(isAbove(meshes[1], meshes[0])).toBe(true)
    })
  })
})

describe('getCenterAltitudeAbove() 3D utility', () => {
  it('considers heights when positioning mesh above another one (without fresh matrix)', () => {
    const box = createBox('box', { height: 4 })
    box.setAbsolutePosition(new Vector3(0, 20, 0))
    const box2 = createBox('box2', { height: 3 })
    expect(getCenterAltitudeAbove(box, box2)).toEqual(
      20 + 4 / 2 + 3 / 2 + altitudeGap
    )
  })
})

// TODO rotations
function setPosition(
  /** @type {{ x: number, z: number, y: number, mesh: Mesh }[]} */ meshesAndPositions
) {
  for (const { x, y, z, mesh } of meshesAndPositions) {
    mesh.setAbsolutePosition(new Vector3(x, y, z))
  }
}
