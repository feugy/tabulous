// @ts-check
/**
 * @typedef {import('@babylonjs/core').PBRSpecularGlossinessMaterial} Material
 * @typedef {import('@babylonjs/core').Scene} Scene
 */

import { faker } from '@faker-js/faker'
import { createTable } from '@src/3d/utils'
import { describe, expect, it } from 'vitest'

import { configures3dTestEngine } from '../../test-utils'

describe('createTable() 3D utility', () => {
  /** @type {Scene} */
  let scene
  /** @type {import('@src/3d/managers').Managers} */
  let managers

  configures3dTestEngine(created => {
    scene = created.scene
    managers = created.managers
  })

  it('creates a table mesh with parameters', () => {
    const width = faker.number.int(999)
    const height = faker.number.int(999)
    const texture = `/${faker.lorem.word()}`
    const table = createTable({ width, height, texture }, managers, scene)
    const { boundingBox } = table.getBoundingInfo()
    expect(table.name).toEqual('table')
    expect(boundingBox.extendSize.x * 2).toEqual(width)
    expect(boundingBox.extendSize.z * 2).toEqual(height)
    expect(
      /** @type {Material} */ (table.material).diffuseTexture?.name
    ).toEqual('https://localhost:3000' + texture)
    expect(table.isPickable).toBe(false)
    expect(table.absolutePosition.x).toEqual(0)
    expect(table.absolutePosition.y).toBeCloseTo(-0.01)
    expect(table.absolutePosition.z).toEqual(0)
  })

  it('creates a table mesh with a color', () => {
    const texture = `${faker.internet.color().toUpperCase()}FF`
    const table = createTable({ texture }, managers, scene)
    expect(
      /** @type {Material} */ (table.material).diffuseColor
        ?.toGammaSpace()
        .toHexString()
    ).toEqual(texture.slice(0, -2))
    expect(/** @type {Material} */ (table.material).diffuseTexture).toBeNull()
  })

  it('creates a table mesh with default values', () => {
    const table = createTable(undefined, managers, scene)
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
