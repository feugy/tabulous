// @ts-check
/**
 * @typedef {import('@tabulous/server/src/graphql').Game} Game
 * @typedef {import('@tabulous/server/src/services/catalog').AddPlayer<?>} AddPlayer
 * @typedef {import('@tabulous/server/src/services/catalog').Build} Build
 * @typedef {import('@tabulous/server/src/services/catalog').GameDescriptor} GameDescriptor
 * @typedef {import('@tabulous/server/src/services/games').Schema<?>} Schema
 * @typedef {import('@tabulous/server/src/services/games').StartedGameData} StartedGameData
 * @typedef {import('@tabulous/server/src/services/players').Player} Player
 * @typedef {import('@tabulous/server/src/utils/games').GameSetup} GameSetup
 */

import { faker } from '@faker-js/faker'
import {
  ajv,
  createMeshes,
  pickRandom
} from '@tabulous/server/src/utils/index.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

export function buildDescriptorTestSuite(
  /** @type {string} */ name,
  /** @type {GameDescriptor} */ descriptor
) {
  describe(`${name} game descriptor`, () => {
    beforeEach(() => {
      // no random factor so we get stable results with game random bags.
      vi.spyOn(Math, 'random').mockReturnValue(0)
    })

    it('exports a compliant game descriptor', () => {
      expect(descriptor).toMatchObject({
        build: expect.any(Function),
        locales: {
          fr: { title: expect.any(String) },
          en: { title: expect.any(String) }
        }
      })
      expectNumber(descriptor, 'minSeats')
      expectNumber(descriptor, 'maxSeats', 0, 8)
      expectNumber(descriptor, 'minAge')
      expectNumber(descriptor, 'maxAge')
      expectNumber(descriptor, 'minTime')
      expectObject(descriptor, 'copyright', {
        authors: ['array', 'object', { name: ['string'] }],
        designers: ['array', 'object', { name: ['string'] }],
        publishers: ['array', 'object', { name: ['string'] }]
      })
      expectNumber(descriptor, 'rulesBookPageCount')
      expectObject(descriptor, 'zoomSpec', {
        min: ['number'],
        max: ['number'],
        hand: ['number']
      })
      expectObject(descriptor, 'tableSpec', {
        width: ['number'],
        height: ['number'],
        texture: ['string']
      })
      expectObject(descriptor, 'colors', {
        base: ['string'],
        primary: ['string'],
        secondary: ['string'],
        players: ['array', 'string']
      })
      expectObject(descriptor, 'actions', {
        button1: ['array', 'string', actionNames],
        button2: ['array', 'string', actionNames],
        button3: ['array', 'string', actionNames]
      })
      expectFunction(descriptor, 'addPlayer')
      expectFunction(descriptor, 'askForParameters')
      if ('askForParameters' in descriptor) {
        expect('addPlayer' in descriptor).toBe(true)
      }
    })

    describe.skipIf(!descriptor.build)('build()', () => {
      it('builds game setup', async () => {
        const initial = await descriptor.build?.()
        if (initial) {
          expectArray(initial, 'meshes', 'object', {})
          if (initial.bags) {
            expect(initial.bags).toBeInstanceOf(Map)
          }
          expectArray(initial, 'slots', 'object', {
            bagId: ['string'],
            anchorId: ['string'],
            count: ['number']
          })
          expect(initial).toMatchSnapshot()
        }
      })
    })

    describe.skipIf(!descriptor.addPlayer)(
      'askForParameters() + addPlayer()',
      () => {
        it('enrolls each allowed players with a valid JSON schema', async () => {
          let game = await buildGame(
            /** @type {GameDescriptor} */ ({ ...descriptor, name })
          )
          for (let rank = 1; rank <= (descriptor.maxSeats ?? 8); rank++) {
            const player = makePlayer(rank)
            let schema = null
            if (descriptor.askForParameters) {
              schema = await descriptor.askForParameters({ game, player })
              if (schema) {
                expect(
                  ajv.validateSchema(schema),
                  `invalid schema for player #${rank}: ${ajv.errorsText}`
                ).toBe(true)
              }
            }
            game = await enroll(
              descriptor,
              game,
              player,
              buildParameters(schema)
            )
            expect(game).toMatchSnapshot()
          }
        })
      }
    )
  })
}

/** @returns {Player} */
function makePlayer(/** @type {number} */ rank) {
  return {
    id: `player-${rank}`,
    username: faker.person.firstName(),
    currentGameId: null
  }
}

/** @returns {Promise<StartedGameData>} */
async function buildGame(/** @type {GameDescriptor} */ descriptor) {
  return {
    id: 'game-unique-id',
    kind: descriptor.name,
    name: descriptor.name,
    locales: descriptor.locales,
    ownerId: '',
    playerIds: [],
    guestIds: [],
    created: 1691859511667,
    availableSeats: descriptor.maxSeats ?? 2,
    meshes: await createMeshes(descriptor.name, descriptor),
    cameras: [],
    hands: [],
    preferences: [],
    messages: []
  }
}

async function enroll(
  /** @type {GameDescriptor} */ descriptor,
  /** @type {StartedGameData} */ game,
  /** @type {Player} */ guest,
  /** @type {Record<string, ?>} */ parameters
) {
  game.playerIds.push(guest.id)
  game.availableSeats--
  game.preferences.push({
    playerId: guest.id,
    color:
      parameters?.color ??
      pickRandom(
        game.colors?.players,
        game.preferences.map(({ color }) => color)
      )
  })
  return await /** @type {GameDescriptor & { addPlayer: AddPlayer }} */ (
    descriptor
  ).addPlayer(game, guest, /** @type {?} */ (parameters))
}

function buildParameters(/** @type {?Schema} */ schema) {
  /** @type {Record<string, ?>} */
  const result = {}
  if (schema?.type === 'object') {
    for (const property of schema.required) {
      const propSchema = schema.properties[property]
      const value = propSchema.enum?.[0] ?? null
      result[property] = value
    }
  }
  return result
}

/** @typedef {'number'|'string'|'array'|'object'|'function'} Type */

const actionNames = [
  'decrement',
  'detail',
  'draw',
  'flip',
  'flipAll',
  'increment',
  'pop',
  'push',
  'random',
  'reorder',
  'rotate',
  'setFace',
  'snap',
  'toggleLock',
  'unsnap',
  'unsnapAll'
]

function expectType(
  /** @type {Record<string, ?>} */ actual,
  /** @type {string} */ property,
  /** @type {Type} */ type,
  /** @type {...?} */ ...args
) {
  if (type === 'number') {
    expectNumber(actual, property, ...args)
  } else if (type === 'string') {
    expectString(actual, property, ...args)
  } else if (type === 'array') {
    expectArray(actual, property, ...args)
  } else if (type === 'object') {
    expectObject(actual, property, ...args)
  } else {
    expectFunction(actual, property)
  }
}

function expectFunction(
  /** @type {Record<string, ?>} */ actual,
  /** @type {string} */ property
) {
  const value = actual[last(property)]
  if (value !== undefined) {
    expect(value, property).toBeTypeOf('function')
  }
}

function expectObject(
  /** @type {Record<string, ?>} */ actual,
  /** @type {string} */ property,
  /** @type {Record<string, [Type, ...?[]]>} */ expected
) {
  const value = actual[last(property)]
  if (value !== undefined) {
    expect(value, property).toBeTypeOf('object')
    for (const [subproperty, args] of Object.entries(expected)) {
      const path = `${property}.${subproperty}`
      expectType(value, path, ...args)
    }
  }
}

function expectArray(
  /** @type {Record<string, ?>} */ actual,
  /** @type {string} */ property,
  /** @type {...?} */ ...args
) {
  const value = actual[last(property)]
  if (value !== undefined) {
    expect(value, property).toBeInstanceOf(Array)
    for (const rank of value.keys()) {
      expectType(value, `${property}.${rank}`, ...args)
    }
  }
}

function expectString(
  /** @type {Record<string, ?>} */ actual,
  /** @type {string} */ property,
  /** @type {string[]} */ allowed = []
) {
  const value = actual[last(property)]
  if (value !== undefined) {
    expect(value, property).toBeTypeOf('string')
    if (allowed.length) {
      expect(allowed, property).toContain(value)
    }
  }
}

function expectNumber(
  /** @type {Record<string, ?>} */ actual,
  /** @type {string} */ property,
  min = 0,
  /** @type {?number} */ max = null
) {
  const value = actual[last(property)]
  if (value !== undefined) {
    expect(value, property).toBeTypeOf('number')
    expect(value, property).toBeGreaterThan(min)
    if (max !== null) {
      expect(value, property).toBeLessThanOrEqual(8)
    }
  }
}

function last(/** @type {string} */ property) {
  return /** @type {string} */ (property.split('.').pop())
}
