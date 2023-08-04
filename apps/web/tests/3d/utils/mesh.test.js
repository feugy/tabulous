// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 */

import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Logger } from '@babylonjs/core/Misc/logger'
import { Scene } from '@babylonjs/core/scene'
import {
  applyInitialTransform,
  getDimensions,
  isContaining
} from '@src/3d/utils'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createBox, expectDimension } from '../../test-utils'

/** @type {Engine} */
let engine

beforeAll(() => {
  Logger.LogLevels = 0
  engine = new NullEngine()
  new Scene(engine)
})

afterAll(() => engine.dispose())

describe('getDimensions() 3D utility', () => {
  it('returns the height of a box', () => {
    const height = 3
    const width = 2
    const depth = 2
    const box = createBox('box', { width, height, depth })
    expect(getDimensions(box)).toEqual({ height, width, depth })
  })

  it('returns the height of a positionned box', () => {
    const height = 6
    const width = 2
    const depth = 4
    const box = createBox('box', { width, height, depth })
    box.setAbsolutePosition(new Vector3(-3, -5, -6))
    expect(getDimensions(box)).toEqual({ height, width, depth })
  })

  it('returns the height of a rotated box', () => {
    const height = 6
    const width = 3
    const depth = 4
    const box = createBox('box', { width, height, depth })
    box.rotation.x = Math.PI / 4
    box.setAbsolutePosition(new Vector3(2, 4, 6))
    expect(getDimensions(box).width).toEqual(width)
    expect(getDimensions(box).height).toBeGreaterThan(height)
    expect(getDimensions(box).depth).toBeGreaterThan(depth)
  })
})

describe('isContaining() 3D utility', () => {
  /** @type {Mesh} */
  let bigBox
  /** @type {Mesh} */
  let smallBox

  beforeAll(() => {
    bigBox = createBox('Md', { width: 10, height: 10, depth: 10 })
    smallBox = createBox('Sm', { width: 3, height: 3, depth: 3 })
  })

  beforeEach(() => {
    bigBox.setAbsolutePosition(Vector3.Zero())
    smallBox.setAbsolutePosition(Vector3.Zero())
  })

  it('returns true when testing whether the big box is containing the small one', () => {
    expect(isContaining(bigBox, smallBox)).toBe(true)
  })

  it('returns false when testing whether the small box is containing the big one', () => {
    expect(isContaining(smallBox, bigBox)).toBe(false)
  })

  it('returns false when testing boxes that do not interesects', () => {
    smallBox.setAbsolutePosition(new Vector3(0, 20, 0))
    expect(isContaining(bigBox, smallBox)).toBe(false)
  })

  it('returns false when testing boxes that interesects', () => {
    smallBox.setAbsolutePosition(new Vector3(0, 4, 0))
    expect(isContaining(bigBox, smallBox)).toBe(false)
  })
})

describe('applyInitialTransform() 3D utility', () => {
  /** @type {Mesh} */
  let box

  beforeEach(() => {
    box = createBox('box', { width: 4, height: 8, depth: 2 })
  })

  it('does nothing without tranform', () => {
    applyInitialTransform(box)
    expectDimension(box, [4, 8, 2])
  })

  it('can skew on X', () => {
    applyInitialTransform(box, { scaleX: 2 })
    expectDimension(box, [8, 8, 2])
  })

  it('can skew on Y', () => {
    applyInitialTransform(box, { scaleY: 2 })
    expectDimension(box, [4, 16, 2])
  })

  it('can skew on Z', () => {
    applyInitialTransform(box, { scaleZ: 0.5 })
    expectDimension(box, [4, 8, 1])
  })

  it('can rotate on X', () => {
    applyInitialTransform(box, { yaw: Math.PI * 0.5 })
    expectDimension(box, [4, 2, 8])
  })

  it('can rotate on Y', () => {
    applyInitialTransform(box, { pitch: Math.PI * 0.5 })
    expectDimension(box, [2, 8, 4])
  })

  it('can rotate on Z', () => {
    applyInitialTransform(box, { roll: Math.PI * 0.5 })
    expectDimension(box, [8, 4, 2])
  })

  it('can rotate and skew', () => {
    applyInitialTransform(box, { roll: Math.PI * 0.5, scaleX: 2, scaleZ: 3 })
    expectDimension(box, [8, 8, 6])
  })
})
