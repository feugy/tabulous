import faker from 'faker'
import { createTable } from '../../../src/3d/utils'
import { configures3dTestEngine } from '../../test-utils'

configures3dTestEngine()

describe('createTable() 3D utility', () => {
  it('creates a table mesh with parameters', () => {
    const width = faker.datatype.number()
    const height = faker.datatype.number()
    const color = [Math.random(), Math.random(), Math.random(), Math.random()]
    const table = createTable({ width, height, color })
    const { boundingBox } = table.getBoundingInfo()
    expect(table.name).toEqual('table')
    expect(boundingBox.extendSize.x * 2).toEqual(width)
    expect(boundingBox.extendSize.z * 2).toEqual(height)
    expect(table.material.emissiveColor.asArray()).toEqual(color)
    expect(table.isPickable).toBe(false)
    expect(table.absolutePosition.x).toEqual(0)
    expect(table.absolutePosition.y).toBeCloseTo(-0.01)
    expect(table.absolutePosition.z).toEqual(0)
  })

  it('creates a table mesh with default values', () => {
    const table = createTable()
    const { boundingBox } = table.getBoundingInfo()
    expect(table.name).toEqual('table')
    expect(boundingBox.extendSize.x * 2).toEqual(100)
    expect(boundingBox.extendSize.z * 2).toEqual(50)
    expect(table.material.emissiveColor.asArray()).toEqual([0.2, 0.2, 0.2, 1])
    expect(table.isPickable).toBe(false)
    expect(table.absolutePosition.x).toEqual(0)
    expect(table.absolutePosition.y).toBeCloseTo(-0.01)
    expect(table.absolutePosition.z).toEqual(0)
  })
})
