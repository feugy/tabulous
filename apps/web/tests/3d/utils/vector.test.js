import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { GroundBuilder } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import {
  getMeshScreenPosition,
  isAboveTable,
  isPositionAboveTable,
  screenToGround
} from '../../../src/3d/utils/vector'
import { initialize3dEngine } from '../../test-utils'

let engine
let scene
let camera
let box
const renderWidth = 2048
const renderHeight = 1024

beforeAll(() => {
  ;({ engine, camera, scene } = initialize3dEngine({
    renderWidth,
    renderHeight
  }))
  box = BoxBuilder.CreateBox('box', {})
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
    const { x, y, z } = screenToGround(scene, {
      x: renderWidth * 0.5,
      y: renderHeight * 0.5
    })
    expect(x).toBeCloseTo(0, 5)
    expect(y).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(-0.000012, 5)
  })

  it('converts screen top left corner', () => {
    const { x, y, z } = screenToGround(scene, { x: 0, y: 0 })
    expect(x).toBeCloseTo(-51.255399, 5)
    expect(y).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(27.739206, 5)
  })

  it('converts screen bottom right corner', () => {
    const { x, y, z } = screenToGround(scene, {
      x: renderWidth,
      y: renderHeight
    })
    expect(x).toBeCloseTo(35.978456, 5)
    expect(y).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(-19.47141, 5)
  })

  it('handles camera moves', () => {
    camera.lockedTarget = new Vector3(10, 0, -10)
    const { x, y, z } = screenToGround(scene, {
      x: renderWidth * 0.5,
      y: renderHeight * 0.5
    })
    expect(x).toBeCloseTo(10, 5)
    expect(y).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(-9.999969, 5)
  })
})

describe('isAboveTable() 3D utility', () => {
  let table
  const width = 50
  const height = 25

  it('returns false without table mesh', () => {
    expect(
      isAboveTable(scene, { x: renderWidth * 0.5, y: renderHeight * 0.5 })
    ).toEqual(false)
  })

  it('returns false with disposed table mesh', () => {
    table = GroundBuilder.CreateGround('table', { width, height })
    table.dispose()
    expect(
      isAboveTable(scene, { x: renderWidth * 0.5, y: renderHeight * 0.5 })
    ).toEqual(false)
  })

  describe('given a table mesh', () => {
    beforeAll(
      () => (table = GroundBuilder.CreateGround('table', { width, height }))
    )

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
  let table
  const width = 50
  const height = 25

  it('returns false without table mesh', () => {
    expect(isPositionAboveTable(scene, Vector3.Zero())).toEqual(false)
  })

  it('returns false with disposed table mesh', () => {
    table = GroundBuilder.CreateGround('table', { width, height })
    table.dispose()
    expect(isPositionAboveTable(scene, Vector3.Zero())).toEqual(false)
  })

  describe('given a table mesh', () => {
    beforeAll(
      () => (table = GroundBuilder.CreateGround('table', { width, height }))
    )

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
    const { x, y } = getMeshScreenPosition(box)
    expect(x).toBeCloseTo(1377.798085, 5)
    expect(y).toBeCloseTo(472.344409, 5)
  })

  it('considers camera moves', () => {
    box.setAbsolutePosition(new Vector3(10, 15, -5))
    camera.lockedTarget = new Vector3(10, 10, 10)
    camera.beta = Math.PI
    scene.updateTransformMatrix()
    const { x, y } = getMeshScreenPosition(box)
    expect(x).toBeCloseTo(1023.999991, 5)
    expect(y).toBeCloseTo(181.728928, 5)
  })

  it('handles missing mesh', () => {
    expect(getMeshScreenPosition()).toBeNull()
    expect(getMeshScreenPosition(null)).toBeNull()
  })
})
