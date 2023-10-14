// @ts-check
import { faker } from '@faker-js/faker'
import Ajv from 'ajv/dist/2020.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMeshes, pickRandom, reportReusedIds } from '../src'

const ajv = new Ajv({
  $data: true,
  allErrors: true,
  strictSchema: false
})

/** @template {Record<string, ?>} Parameters */
export function buildDescriptorTestSuite(
  /** @type {string} */ name,
  /** @type {Partial<import('@tabulous/types').GameDescriptor<Parameters>>} */ descriptor,
  /** @type {(utils: GameTestUtils) => void} */ customTests = () => {}
) {
  describe(`${name} game descriptor`, () => {
    let counter = 1

    beforeEach(() => {
      // no random factor so we get stable results with game random bags.
      vi.spyOn(Math, 'random').mockReturnValue(0)
      vi.spyOn(crypto, 'randomUUID').mockImplementation(
        () => `00000000-0000-0000-0000-000000${counter++}`
      )
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
        button2: ['array', 'string', actionNames]
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
            /** @type {import('@tabulous/types').GameDescriptor<Parameters>} */ ({
              ...descriptor,
              name
            })
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
              /** @type {Required<Pick<import('@tabulous/types').GameDescriptor<Parameters>, 'addPlayer'>>} */ (
                descriptor
              ),
              game,
              player,
              buildParameters(schema)
            )
            reportReusedIds(game, true)
            expect(game).toMatchSnapshot()
          }
        })
      }
    )

    customTests?.({ name, makePlayer, buildGame, enroll, buildParameters })
  })
}

/**
 * @typedef {object} GameTestUtils
 * @property {string} name - tested game name.
 * @property {typeof makePlayer} makePlayer - buils a player.
 * @property {typeof buildGame} buildGame - builds a game from a game setup.
 * @property {typeof enroll} enroll - enrolls a player in a game.
 * @property {typeof buildParameters} buildParameters - builds game parameters from the provided schema.
 */

/** @returns {import('@tabulous/types').Player} */
function makePlayer(/** @type {number} */ rank) {
  return {
    id: `player-${rank}`,
    username: faker.person.firstName(),
    currentGameId: null
  }
}

/**
 * @template {Record<string, ?>} Parameters
 * @returns {Promise<import('@tabulous/types').StartedGame>}
 */
async function buildGame(
  /** @type {import('@tabulous/types').GameDescriptor<Parameters>} */ descriptor
) {
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
    messages: [],
    history: []
  }
}

/** @template {Record<string, ?>} Parameters */
export async function enroll(
  /** @type {Required<Pick<import('@tabulous/types').GameDescriptor<Parameters>, 'addPlayer'>>} */ descriptor,
  /** @type {import('@tabulous/types').StartedGame} */ game,
  /** @type {import('@tabulous/types').Player} */ guest,
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
  return await descriptor.addPlayer(
    game,
    guest,
    /** @type {Parameters} */ (parameters)
  )
}

/** @template {Record<string, ?>} Parameters */
export function buildParameters(
  /** @type {?import('@tabulous/types').Schema<Parameters>} */ schema
) {
  /** @type {Record<string, ?>} */
  const result = {}
  if (schema?.type === 'object') {
    for (const property of schema.required) {
      const propSchema = schema.properties[property]
      const value =
        (property === 'playerCount'
          ? propSchema.enum?.[propSchema.enum.length - 1]
          : propSchema.enum?.[0]) ?? null
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
  'play',
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
