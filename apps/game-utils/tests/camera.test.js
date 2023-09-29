// @ts-check
import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'

import { buildCameraPosition } from '../src/camera.js'

describe('buildCameraPosition()', () => {
  it('applies all defaults', () => {
    const playerId = faker.string.uuid()
    expect(buildCameraPosition({ playerId })).toEqual({
      playerId,
      index: 0,
      target: [0, 0, 0],
      alpha: (Math.PI * 3) / 2,
      beta: Math.PI / 8,
      elevation: 35,
      hash: '0-0-0-4.71238898038469-0.39269908169872414-35'
    })
  })

  it('throws on missing player id', () => {
    expect(() => buildCameraPosition({})).toThrow(
      'camera position requires playerId'
    )
  })

  it('uses provided data and computes hash', () => {
    const playerId = faker.string.uuid()
    const index = faker.number.int()
    const alpha = faker.number.int()
    const beta = faker.number.int()
    const elevation = faker.number.int()
    const target = [faker.number.int(), faker.number.int(), faker.number.int()]
    expect(
      buildCameraPosition({ playerId, index, alpha, beta, elevation, target })
    ).toEqual({
      playerId,
      index,
      target,
      alpha,
      beta,
      elevation,
      hash: `${target[0]}-${target[1]}-${target[2]}-${alpha}-${beta}-${elevation}`
    })
  })
})
