// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import {
  getAbsoluteRotation,
  getMeshScreenPosition,
  getScreenPosition,
  isAboveTable,
  isPositionAboveTable,
  screenToGround
} from '@src/3d/utils'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  createBox,
  expectCloseVector,
  initialize3dEngine
} from '../../test-utils'

/** @type {import('@babylonjs/core').Engine} */
let engine
/** @type {import('@babylonjs/core').Scene} */
let scene
/** @type {import('@babylonjs/core').ArcRotateCamera} */
let camera
/** @type {import('@babylonjs/core').Mesh} */
let box
const renderWidth = 2048
const renderHeight = 1024

beforeAll(() => {
  ;({ engine, camera, scene } = initialize3dEngine({
    renderWidth,
    renderHeight
  }))
  box = createBox('box', {})
})

afterEach(() => {
  camera.lockedTarget = Vector3.Zero()
  camera.alpha = (3 * Math.PI) / 2
  camera.beta = Math.PI / 8
  scene.updateTransformMatrix()
})

afterAll(() => engine.dispose())

describe('screenToGround() 3D utility', () => {
  it('converts screen center position to ground origin', () => {
    expectCloseVector(
      screenToGround(scene, {
        x: renderWidth * 0.5,
        y: renderHeight * 0.5
      }),
      [0, 0, -0.000012],
      undefined,
      5
    )
  })

  it('converts screen top left corner', () => {
    expectCloseVector(
      screenToGround(scene, {
        x: 0,
        y: 0
      }),
      [-51.255399, 0, 27.739206],
      undefined,
      5
    )
  })

  it('converts screen bottom right corner', () => {
    expectCloseVector(
      screenToGround(scene, {
        x: renderWidth,
        y: renderHeight
      }),
      [35.978456, 0, -19.47141],
      undefined,
      5
    )
  })

  it('handles camera moves', () => {
    camera.lockedTarget = new Vector3(10, 0, -10)
    expectCloseVector(
      screenToGround(scene, {
        x: renderWidth * 0.5,
        y: renderHeight * 0.5
      }),
      [10, 0, -9.999969],
      undefined,
      5
    )
  })
})

describe('isAboveTable() 3D utility', () => {
  /** @type {import('@babylonjs/core').Mesh} */
  let table
  const width = 50
  const height = 25

  it('returns false without table mesh', () => {
    expect(
      isAboveTable(scene, { x: renderWidth * 0.5, y: renderHeight * 0.5 })
    ).toEqual(false)
  })

  it('returns false with disposed table mesh', () => {
    table = CreateGround('table', { width, height })
    table.dispose()
    expect(
      isAboveTable(scene, { x: renderWidth * 0.5, y: renderHeight * 0.5 })
    ).toEqual(false)
  })

  describe('given a table mesh', () => {
    beforeAll(() => {
      table = CreateGround('table', { width, height })
    })

    afterAll(() => table.dispose())

    it('returns true for screen position above the table', () => {
      expect(
        isAboveTable(scene, { x: renderWidth * 0.5, y: renderHeight * 0.5 })
      ).toEqual(true)
      expect(
        isAboveTable(scene, { x: renderWidth * 0.4, y: renderHeight * 0.4 })
      ).toEqual(true)
      expect(
        isAboveTable(scene, { x: renderWidth * 0.6, y: renderHeight * 0.6 })
      ).toEqual(true)
    })

    it('returns false for screen position away from the table', () => {
      expect(isAboveTable(scene, { x: 100, y: 100 })).toEqual(false)
      expect(
        isAboveTable(scene, { x: renderWidth - 100, y: renderHeight - 100 })
      ).toEqual(false)
    })

    it('considers camera moves', () => {
      camera.lockedTarget = new Vector3(10, 0, -10)
      expect(
        isAboveTable(scene, { x: renderWidth * 0.5, y: renderHeight * 0.5 })
      ).toEqual(true)
      expect(
        isAboveTable(scene, { x: renderWidth * 0.4, y: renderHeight * 0.4 })
      ).toEqual(true)
      expect(
        isAboveTable(scene, { x: renderWidth * 0.6, y: renderHeight * 0.6 })
      ).toEqual(false)
    })
  })
})

describe('isPositionAboveTable() 3D utility', () => {
  /** @type {import('@babylonjs/core').Mesh} */
  let table
  const width = 50
  const height = 25

  it('returns false without table mesh', () => {
    expect(isPositionAboveTable(scene, Vector3.Zero())).toEqual(false)
  })

  it('returns false with disposed table mesh', () => {
    table = CreateGround('table', { width, height })
    table.dispose()
    expect(isPositionAboveTable(scene, Vector3.Zero())).toEqual(false)
  })

  describe('given a table mesh', () => {
    beforeAll(() => {
      table = CreateGround('table', { width, height })
    })

    afterAll(() => table.dispose())

    it('returns true for screen position above the table', () => {
      expect(isPositionAboveTable(scene, Vector3.Zero())).toEqual(true)
      expect(isPositionAboveTable(scene, new Vector3(2, 5, 2))).toEqual(true)
      expect(isPositionAboveTable(scene, new Vector3(-2, 6, 0))).toEqual(true)
    })

    it('returns false for screen position away from the table', () => {
      expect(isPositionAboveTable(scene, new Vector3(2, 10, 2))).toEqual(false)
      expect(isPositionAboveTable(scene, new Vector3(-2, -10, 0))).toEqual(
        false
      )
    })

    it('ignores camera moves', () => {
      camera.lockedTarget = new Vector3(10, 10, 10)
      expect(isPositionAboveTable(scene, Vector3.Zero())).toEqual(true)
      expect(isPositionAboveTable(scene, new Vector3(2, 5, 2))).toEqual(true)
      expect(isPositionAboveTable(scene, new Vector3(-2, 6, 0))).toEqual(true)
    })
  })
})

describe('getMeshScreenPosition() 3D utility', () => {
  it('returns screen position of a centered mesh', () => {
    expect(getMeshScreenPosition(box)).toEqual({
      x: renderWidth / 2,
      y: renderHeight / 2
    })
  })

  it('returns screen position of a positioned mesh', () => {
    box.setAbsolutePosition(new Vector3(10, 15, -5))
    const { x, y } = getMeshScreenPosition(box) ?? {}
    expect(x).toBeCloseTo(1377.798085, 5)
    expect(y).toBeCloseTo(472.344409, 5)
  })

  it('considers camera moves', () => {
    box.setAbsolutePosition(new Vector3(10, 15, -5))
    camera.lockedTarget = new Vector3(10, 10, 10)
    camera.beta = Math.PI
    scene.updateTransformMatrix()
    const { x, y } = getMeshScreenPosition(box) ?? {}
    expect(x).toBeCloseTo(1023.999991, 5)
    expect(y).toBeCloseTo(181.728928, 5)
  })

  it('handles missing mesh', () => {
    expect(getMeshScreenPosition(undefined)).toBeNull()
    expect(getMeshScreenPosition(null)).toBeNull()
  })
})

describe('getScreenPosition() 3D utility', () => {
  it('returns screen position of centered point', () => {
    expect(getScreenPosition(scene, Vector3.Zero())).toEqual({
      x: renderWidth / 2,
      y: renderHeight / 2
    })
  })

  it('returns screen position of a point', () => {
    const { x, y } = getScreenPosition(scene, new Vector3(10, 15, -5))
    expect(x).toBeCloseTo(1377.798085, 5)
    expect(y).toBeCloseTo(472.344409, 5)
  })

  it('considers camera moves', () => {
    camera.lockedTarget = new Vector3(10, 10, 10)
    camera.beta = Math.PI
    scene.updateTransformMatrix()
    const { x, y } = getScreenPosition(scene, new Vector3(10, 15, -5))
    expect(x).toBeCloseTo(1023.999991, 5)
    expect(y).toBeCloseTo(181.728928, 5)
  })
})

describe('getAbsoluteRotation() 3D utility', () => {
  it('returns rotation of a single mesh', () => {
    const mesh = createBox('box2')
    const angle = Math.PI * 0.5
    mesh.rotation.z = angle
    mesh.computeWorldMatrix(true)
    const { x, y, z } = getAbsoluteRotation(mesh)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(angle)
  })

  it('returns rotation of a child mesh', () => {
    const parent = createBox('parent')
    const parentAngle = Math.PI * 0.5
    parent.rotation.y = parentAngle
    const child = createBox('child')
    child.setParent(parent)
    const childAngle = Math.PI
    child.rotation.y = childAngle
    parent.computeWorldMatrix(true)
    const { x, y, z } = getAbsoluteRotation(child)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(parentAngle - childAngle)
    expect(z).toBeCloseTo(0)
  })
})
