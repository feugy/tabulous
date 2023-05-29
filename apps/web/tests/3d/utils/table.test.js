import { faker } from '@faker-js/faker'
import { materialManager } from '@src/3d/managers'
import { createTable } from '@src/3d/utils'
import { beforeAll, describe, expect, it } from 'vitest'

import { configures3dTestEngine } from '../../test-utils'

describe('createTable() 3D utility', () => {
  let scene
  let handScene

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
  })

  beforeAll(() => materialManager.init({ scene, handScene }))

  it('creates a table mesh with parameters', () => {
    const width = faker.number.int(999)
    const height = faker.number.int(999)
    const texture = faker.internet.url()
    const table = createTable({ width, height, texture })
    const { boundingBox } = table.getBoundingInfo()
    expect(table.name).toEqual('table')
    expect(boundingBox.extendSize.x * 2).toEqual(width)
    expect(boundingBox.extendSize.z * 2).toEqual(height)
    expect(table.material.diffuseTexture?.name).toEqual(texture)
    expect(table.isPickable).toBe(false)
    expect(table.absolutePosition.x).toEqual(0)
    expect(table.absolutePosition.y).toBeCloseTo(-0.01)
    expect(table.absolutePosition.z).toEqual(0)
  })

  it('creates a table mesh with a color', () => {
    const texture = `${faker.internet.color().toUpperCase()}FF`
    const table = createTable({ texture })
    expect(table.material.diffuseColor?.toGammaSpace().toHexString()).toEqual(
      texture
    )
    expect(table.material.diffuseTexture).toBeNull()
  })

  it('creates a table mesh with default values', () => {
    const table = createTable()
    const { boundingBox } = table.getBoundingInfo()
    expect(table.name).toEqual('table')
    expect(boundingBox.extendSize.x * 2).toEqual(400)
    expect(boundingBox.extendSize.z * 2).toEqual(400)
    expect(table.isPickable).toBe(false)
    expect(table.absolutePosition.x).toEqual(0)
    expect(table.absolutePosition.y).toBeCloseTo(-0.01)
    expect(table.absolutePosition.z).toEqual(0)
  })
})
