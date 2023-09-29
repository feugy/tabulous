// @ts-check
import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  decrement,
  findAnchor,
  findMesh,
  pop,
  snapTo,
  stackMeshes,
  unsnap
} from '../src/mesh.js'
import { cloneAsJSON, makeGame } from './test-utils.js'

describe('pop()', () => {
  /** @type {import('@tabulous/types').StartedGame} */
  let game

  beforeEach(() => {
    game = makeGame({
      meshes: [
        { id: 'A', texture: '', shape: 'box' },
        {
          id: 'B',
          texture: '',
          shape: 'box',
          anchorable: { anchors: [{ id: 'discard', snappedId: 'C' }] }
        },
        {
          id: 'C',
          texture: '',
          shape: 'box',
          stackable: { stackIds: ['A', 'E', 'D'] }
        },
        { id: 'D', texture: '', shape: 'box' },
        { id: 'E', texture: '', shape: 'box' }
      ]
    })
  })

  it('draws one mesh from a stack', () => {
    const { meshes } = game
    expect(pop('C', 1, game.meshes)).toEqual([meshes[3]])
    expect(meshes[2].stackable?.stackIds).toEqual(['A', 'E'])
  })

  it('draws several meshes from a stack', () => {
    const { meshes } = game
    expect(pop('C', 2, meshes)).toEqual([meshes[3], meshes[4]])
    expect(meshes[2].stackable?.stackIds).toEqual(['A'])
  })

  it('can deplete a stack', () => {
    const { meshes } = game
    expect(pop('C', 10, meshes)).toEqual([
      meshes[3],
      meshes[4],
      meshes[0],
      meshes[2]
    ])
    expect(meshes[2].stackable?.stackIds).toEqual([])
  })

  it('does nothing on unstackable meshes', () => {
    expect(pop('A', 1, game.meshes, false)).toEqual([])
  })

  it('can throw on unstackable meshes', () => {
    expect(() => pop('A', 1, game.meshes)).toThrow('Mesh A is not stackable')
  })

  it('does nothing on unknown meshes', () => {
    expect(pop('K', 1, game.meshes, false)).toEqual([])
  })

  it('can throw on unknown meshes', () => {
    expect(() => pop('K', 1, game.meshes)).toThrow('No mesh with id K')
  })
})

describe('findMesh()', () => {
  const meshes = Array.from({ length: 10 }, () => ({
    id: faker.string.uuid(),
    texture: '',
    shape: /** @type {const} */ ('box')
  }))

  it('returns existing meshes', () => {
    expect(findMesh(meshes[5].id, meshes)).toEqual(meshes[5])
    expect(findMesh(meshes[8].id, meshes)).toEqual(meshes[8])
  })

  it.each([faker.string.uuid(), meshes[0].id])(
    'returns null on unknown ids',
    anchor => {
      expect(findMesh(anchor, [], false)).toBeNull()
    }
  )

  it.each([faker.string.uuid(), meshes[0].id])(
    'can throw on unknown ids',
    id => {
      expect(() => findMesh(id, [])).toThrow(`No mesh with id ${id}`)
    }
  )
})

describe('findAnchor()', () => {
  const anchors = Array.from({ length: 10 }, () => ({
    id: faker.string.uuid()
  }))

  const meshes = [
    { id: 'mesh0', texture: '', shape: /** @type {const} */ ('box') },
    {
      id: 'mesh1',
      texture: '',
      shape: /** @type {const} */ ('box'),
      anchorable: { anchors: anchors.slice(0, 3) }
    },
    {
      id: 'mesh2',
      texture: '',
      shape: /** @type {const} */ ('box'),
      anchorable: { anchors: [] }
    },
    {
      id: 'mesh3',
      texture: '',
      shape: /** @type {const} */ ('box'),
      anchorable: { anchors: anchors.slice(3, 6) }
    },
    {
      id: 'mesh4',
      texture: '',
      shape: /** @type {const} */ ('box'),
      anchorable: { anchors: anchors.slice(6) }
    }
  ]

  it.each([faker.string.uuid(), anchors[0].id])(
    'returns null on unknown anchor',
    anchor => {
      expect(findAnchor(anchor, [], false)).toBeNull()
    }
  )

  it.each([faker.string.uuid(), anchors[0].id])(
    'can throw on unknown anchor',
    anchor => {
      expect(() => findAnchor(anchor, [])).toThrow(
        `No anchor with id ${anchor}`
      )
    }
  )

  it('returns existing anchor', () => {
    expect(findAnchor(anchors[0].id, meshes)).toEqual(anchors[0])
    expect(findAnchor(anchors[4].id, meshes)).toEqual(anchors[4])
    expect(findAnchor(anchors[7].id, meshes)).toEqual(anchors[7])
  })

  it('returns existing, deep, anchor', () => {
    const meshes = [
      {
        id: 'mesh0',
        texture: '',
        shape: /** @type {const} */ ('box'),
        anchorable: { anchors: [{ id: 'bottom' }] }
      },
      {
        id: 'mesh1',
        texture: '',
        shape: /** @type {const} */ ('box'),
        anchorable: { anchors: [{ id: 'bottom', snappedId: 'mesh3' }] }
      },
      {
        id: 'mesh2',
        texture: '',
        shape: /** @type {const} */ ('box'),
        anchorable: { anchors: [{ id: 'start', snappedId: 'mesh1' }] }
      },
      {
        id: 'mesh3',
        texture: '',
        shape: /** @type {const} */ ('box'),
        anchorable: { anchors: [{ id: 'bottom', snappedId: 'mesh0' }] }
      }
    ]
    expect(findAnchor('start.bottom', meshes)).toEqual(
      meshes[1].anchorable?.anchors?.[0]
    )
    expect(findAnchor('start.bottom.bottom', meshes)).toEqual(
      meshes[3].anchorable?.anchors?.[0]
    )
    expect(findAnchor('start.bottom.bottom.bottom', meshes)).toEqual(
      meshes[0].anchorable?.anchors?.[0]
    )
    expect(findAnchor('bottom', meshes)).toEqual(
      meshes[0].anchorable?.anchors?.[0]
    )
  })
})

describe('snapTo()', () => {
  /** @type {import('@tabulous/types').Mesh[]} */
  let meshes

  beforeEach(() => {
    meshes = [
      { id: 'mesh0', texture: '', shape: 'box' },
      {
        id: 'mesh1',
        texture: '',
        shape: 'box',
        anchorable: { anchors: [{ id: 'anchor1' }] }
      },
      {
        id: 'mesh2',
        texture: '',
        shape: 'box',
        anchorable: { anchors: [{ id: 'anchor2' }, { id: 'anchor3' }] }
      },
      { id: 'mesh3', texture: '', shape: 'box' }
    ]
  })

  it('snaps a mesh to an existing anchor', () => {
    expect(snapTo('anchor3', meshes[0], meshes)).toBe(true)
    expect(meshes[2]).toEqual({
      id: 'mesh2',
      texture: '',
      shape: 'box',
      anchorable: {
        anchors: [{ id: 'anchor2' }, { id: 'anchor3', snappedId: 'mesh0' }]
      }
    })
  })

  it('stacks a mesh if anchor is in use', () => {
    meshes[0].stackable = {}
    meshes[1].stackable = {}
    expect(snapTo('anchor2', meshes[0], meshes)).toBe(true)
    expect(snapTo('anchor2', meshes[1], meshes)).toBe(true)
    expect(meshes[2]).toEqual({
      id: 'mesh2',
      texture: '',
      shape: 'box',
      anchorable: {
        anchors: [{ id: 'anchor2', snappedId: 'mesh0' }, { id: 'anchor3' }]
      }
    })
    expect(meshes[0]).toEqual({
      id: 'mesh0',
      texture: '',
      shape: 'box',
      stackable: { stackIds: ['mesh1'] }
    })
  })

  it('ignores unstackable mesh on an anchor in use', () => {
    meshes[0].stackable = {}
    expect(snapTo('anchor2', meshes[0], meshes)).toBe(true)
    const state = cloneAsJSON(meshes)
    expect(snapTo('anchor2', meshes[1], meshes)).toBe(false)
    expect(state).toEqual(meshes)
  })

  it('ignores mesh on an anchor in use with unstackable mesh', () => {
    expect(snapTo('anchor2', meshes[0], meshes)).toBe(true)
    meshes[1].stackable = {}
    const state = cloneAsJSON(meshes)
    expect(snapTo('anchor2', meshes[1], meshes)).toBe(false)
    expect(state).toEqual(meshes)
  })

  it('ignores unknown anchor', () => {
    const state = cloneAsJSON(meshes)
    expect(snapTo('anchor10', meshes[0], meshes, false)).toBe(false)
    expect(state).toEqual(meshes)
  })

  it('can throw on unknown anchor', () => {
    expect(() => snapTo('anchor10', meshes[0], meshes)).toThrow(
      'No anchor with id anchor10'
    )
  })

  it('ignores unknown mesh', () => {
    const state = cloneAsJSON(meshes)
    expect(snapTo('anchor1', null, meshes, false)).toBe(false)
    expect(state).toEqual(meshes)
  })

  it('can throw on unknown mesh', () => {
    expect(() => snapTo('anchor1', null, meshes)).toThrow(
      'No mesh to snap on anchor anchor1'
    )
  })
})

describe('unsnap()', () => {
  /** @type {import('@tabulous/types').Mesh[]} */
  let meshes

  beforeEach(() => {
    meshes = [
      {
        id: 'mesh1',
        texture: '',
        shape: 'box',
        anchorable: {
          anchors: [{ id: 'anchor1', snappedId: 'mesh2' }, { id: 'anchor2' }]
        }
      },
      {
        id: 'mesh2',
        texture: '',
        shape: 'box',
        anchorable: {
          anchors: [
            { id: 'anchor3', snappedId: 'mesh3' },
            { id: 'anchor4', snappedId: 'unknown' }
          ]
        }
      },
      {
        id: 'mesh3',
        texture: '',
        shape: 'box'
      }
    ]
  })

  it('returns nothing on unknown anchor', () => {
    expect(unsnap('unknown', meshes, false)).toBeNull()
  })

  it('can throw on unknown anchor', () => {
    expect(() => unsnap('unknown', meshes)).toThrow('No anchor with id unknown')
  })

  it('returns nothing on anchor with no snapped mesh', () => {
    expect(unsnap('anchor2', meshes, false)).toBeNull()
  })

  it('can throw on anchor with no snapped mesh', () => {
    expect(() => unsnap('anchor2', meshes)).toThrow(
      'Anchor anchor2 has no snapped mesh'
    )
  })

  it('returns nothing on anchor with unknown snapped mesh', () => {
    expect(unsnap('anchor4', meshes, false)).toBeNull()
  })

  it('can throw on anchor with unknown snapped mesh', () => {
    expect(() => unsnap('anchor4', meshes)).toThrow('No mesh with id unknown')
  })

  it('returns mesh and unsnapps it', () => {
    expect(unsnap('anchor3', meshes)).toEqual(meshes[2])
    expect(meshes[1].anchorable?.anchors).toEqual([
      { id: 'anchor3', snappedId: null },
      { id: 'anchor4', snappedId: 'unknown' }
    ])
  })
})

describe('stackMeshes()', () => {
  /** @type {import('@tabulous/types').Mesh[]} */
  let meshes

  beforeEach(() => {
    meshes = [
      { id: 'mesh0', texture: '', shape: 'box' },
      { id: 'mesh1', texture: '', shape: 'box' },
      { id: 'mesh2', texture: '', shape: 'box' },
      { id: 'mesh3', texture: '', shape: 'box' },
      { id: 'mesh4', texture: '', shape: 'box' }
    ]
  })

  it('stacks a list of meshes in order', () => {
    stackMeshes(meshes)
    expect(meshes).toEqual([
      {
        id: 'mesh0',
        texture: '',
        shape: 'box',
        stackable: { stackIds: ['mesh1', 'mesh2', 'mesh3', 'mesh4'] }
      },
      ...meshes.slice(1)
    ])
  })

  it('stacks on top of an existing stack', () => {
    meshes[0].stackable = { stackIds: ['mesh4', 'mesh3'] }
    stackMeshes([meshes[0], ...meshes.slice(1, 3)])
    expect(meshes).toEqual([
      {
        id: 'mesh0',
        texture: '',
        shape: 'box',
        stackable: { stackIds: ['mesh4', 'mesh3', 'mesh1', 'mesh2'] }
      },
      ...meshes.slice(1)
    ])
  })

  it('do nothing on a stack of one', () => {
    stackMeshes(meshes.slice(0, 1))
    expect(meshes).toEqual([
      { id: 'mesh0', texture: '', shape: 'box' },
      ...meshes.slice(1)
    ])
  })
})

describe('decrement()', () => {
  it('ignores non quantifiable meshes', () => {
    const mesh = {
      id: 'mesh1',
      texture: '',
      shape: /**@type {const } */ ('box')
    }
    expect(decrement(mesh, false)).toBeNull()
    expect(mesh).toEqual({ id: 'mesh1', texture: '', shape: 'box' })
  })

  it('can throw on non quantifiable meshes', () => {
    expect(() =>
      decrement({
        id: 'mesh1',
        texture: '',
        shape: /**@type {const } */ ('box')
      })
    ).toThrow('Mesh mesh1 is not quantifiable or has a quantity of 1')
  })

  it('ignores quantifiable mesh of 1', () => {
    const mesh = {
      id: 'mesh1',
      texture: '',
      shape: /**@type {const } */ ('box'),
      quantifiable: { quantity: 1 }
    }
    expect(decrement(mesh, false)).toBeNull()
    expect(mesh).toEqual({
      id: 'mesh1',
      texture: '',
      shape: 'box',
      quantifiable: { quantity: 1 }
    })
  })

  it('can throw on quantifiable mesh of 1', () => {
    expect(() =>
      decrement({
        id: 'mesh1',
        texture: '',
        shape: /**@type {const } */ ('box'),
        quantifiable: { quantity: 1 }
      })
    ).toThrow('Mesh mesh1 is not quantifiable or has a quantity of 1')
  })

  it('decrements a quantifiable mesh by 1', () => {
    const mesh = {
      id: 'mesh1',
      texture: '',
      shape: /**@type {const } */ ('box'),
      quantifiable: { quantity: 6 }
    }
    expect(decrement(mesh)).toEqual({
      id: expect.stringMatching(/^mesh1-/),
      texture: '',
      shape: 'box',
      quantifiable: { quantity: 1 }
    })
    expect(mesh).toEqual({
      id: 'mesh1',
      texture: '',
      shape: 'box',
      quantifiable: { quantity: 5 }
    })
  })
})
