// @ts-check
import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it } from 'vitest'

import { drawInHand, findOrCreateHand } from '../src/hand.js'
import { makeGame } from './test-utils.js'

describe('drawInHand()', () => {
  const playerId = faker.string.uuid()
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
          anchorable: {
            anchors: [
              { id: 'discard', snappedIds: ['C'] },
              { id: 'reserve', snappedIds: ['F', 'G'], max: 2 }
            ]
          }
        },
        {
          id: 'C',
          texture: '',
          shape: 'box',
          stackable: { stackIds: ['A', 'E', 'D'] }
        },
        { id: 'D', texture: '', shape: 'box' },
        { id: 'E', texture: '', shape: 'box' },
        { id: 'F', texture: '', shape: 'box' },
        { id: 'G', texture: '', shape: 'box' }
      ]
    })
  })

  it('throws error on unknown anchor', () => {
    expect(() => drawInHand(game, { playerId, fromAnchor: 'unknown' })).toThrow(
      `No anchor with id unknown`
    )
  })

  it('draws one mesh into a new hand', () => {
    drawInHand(game, { playerId, fromAnchor: 'discard' })
    drawInHand(game, { playerId, fromAnchor: 'reserve' })
    expect(game).toEqual(
      expect.objectContaining({
        hands: [
          {
            playerId,
            meshes: [
              { id: 'D', texture: '', shape: 'box' },
              { id: 'F', texture: '', shape: 'box' }
            ]
          }
        ],
        meshes: [
          { id: 'A', texture: '', shape: 'box' },
          {
            id: 'B',
            texture: '',
            shape: 'box',
            anchorable: {
              anchors: [
                { id: 'discard', snappedIds: ['C'] },
                { id: 'reserve', snappedIds: ['G'], max: 2 }
              ]
            }
          },
          {
            id: 'C',
            texture: '',
            shape: 'box',
            stackable: { stackIds: ['A', 'E'] }
          },
          { id: 'E', texture: '', shape: 'box' },
          { id: 'G', texture: '', shape: 'box' }
        ]
      })
    )
  })

  it('draws multiple meshes into a new hand', () => {
    const props = { foo: 'bar' }
    drawInHand(game, { playerId, count: 2, fromAnchor: 'discard', props })
    expect(game).toEqual(
      expect.objectContaining({
        hands: [
          {
            playerId,
            meshes: [
              { id: 'D', texture: '', shape: 'box', ...props },
              { id: 'E', texture: '', shape: 'box', ...props }
            ]
          }
        ],
        meshes: [
          { id: 'A', texture: '', shape: 'box' },
          {
            id: 'B',
            texture: '',
            shape: 'box',
            anchorable: {
              anchors: [
                { id: 'discard', snappedIds: ['C'] },
                { id: 'reserve', snappedIds: ['F', 'G'], max: 2 }
              ]
            }
          },
          {
            id: 'C',
            texture: '',
            shape: 'box',
            stackable: { stackIds: ['A'] }
          },
          { id: 'F', texture: '', shape: 'box' },
          { id: 'G', texture: '', shape: 'box' }
        ]
      })
    )
  })

  it('draws until depletion into a new hand', () => {
    drawInHand(game, { playerId, count: 10, fromAnchor: 'discard' })
    drawInHand(game, { playerId, count: 10, fromAnchor: 'reserve' })
    expect(game).toEqual(
      expect.objectContaining({
        hands: [
          {
            playerId,
            meshes: [
              { id: 'D', texture: '', shape: 'box' },
              { id: 'E', texture: '', shape: 'box' },
              { id: 'A', texture: '', shape: 'box' },
              {
                id: 'C',
                texture: '',
                shape: 'box',
                stackable: { stackIds: [] }
              },
              { id: 'F', texture: '', shape: 'box' }
            ]
          }
        ],
        meshes: [
          {
            id: 'B',
            texture: '',
            shape: 'box',
            anchorable: {
              anchors: [
                { id: 'discard', snappedIds: [] },
                { id: 'reserve', snappedIds: ['G'], max: 2 }
              ]
            }
          },
          { id: 'G', texture: '', shape: 'box' }
        ]
      })
    )
  })

  it('throws when drawing from empty anchor', () => {
    // @ts-expect-error -- we can't use ! operator in JS
    game.meshes[1].anchorable.anchors[0].snappedIds = []
    expect(() =>
      drawInHand(game, { playerId, count: 2, fromAnchor: 'discard' })
    ).toThrow('Anchor discard has no snapped mesh')
  })
})

describe('findOrCreateHand()', () => {
  it('finds existing hand', () => {
    const playerId1 = faker.string.uuid()
    const playerId2 = faker.string.uuid()

    const game = makeGame({
      hands: [
        {
          playerId: playerId1,
          meshes: [
            { id: 'A', texture: '', shape: /** @type {const} */ ('box') }
          ]
        },
        {
          playerId: playerId2,
          meshes: [
            { id: 'B', texture: '', shape: /** @type {const} */ ('box') }
          ]
        }
      ]
    })
    expect(findOrCreateHand(game, playerId1)).toEqual(game.hands[0])
    expect(findOrCreateHand(game, playerId2)).toEqual(game.hands[1])
  })

  it('creates new hand', () => {
    const playerId1 = faker.string.uuid()
    const playerId2 = faker.string.uuid()

    const game = makeGame({
      hands: [
        {
          playerId: playerId1,
          meshes: [
            { id: 'A', texture: '', shape: /** @type {const} */ ('box') }
          ]
        }
      ]
    })
    const created = { playerId: playerId2, meshes: [] }
    expect(findOrCreateHand(game, playerId1)).toEqual(game.hands[0])
    expect(findOrCreateHand(game, playerId2)).toEqual(created)
    expect(game.hands[1]).toEqual(created)
  })
})
