// @ts-check
import { faker } from '@faker-js/faker'
import { vi } from 'vitest'
import { beforeEach, describe, expect, it } from 'vitest'

import { getParameterSchema } from '../../src/utils/games.js'

describe('getParameterSchema()', () => {
  const askForParameters = vi.fn()
  const kind = faker.lorem.word()
  const game = /** @type {import('@tabulous/types').StartedGame} */ ({
    kind,
    meshes: [{ id: faker.string.uuid() }]
  })
  /** @type {import('@tabulous/types').Player} */
  const player = {
    id: faker.string.uuid(),
    username: faker.person.fullName(),
    currentGameId: null
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('enriches game data with parameters', async () => {
    const schema = {
      type: 'object',
      properties: {
        side: {
          type: 'string',
          enum: ['white', 'black']
        }
      }
    }
    askForParameters.mockResolvedValue(schema)
    expect(
      await getParameterSchema({
        descriptor: { askForParameters },
        game,
        player
      })
    ).toEqual({ ...game, schema })
    expect(askForParameters).toHaveBeenCalledWith({ game, player })
  })

  it('handles missing askForParameters()', async () => {
    expect(
      await getParameterSchema({ descriptor: {}, game, player })
    ).toBeNull()
  })

  it('handles no schema', async () => {
    askForParameters.mockResolvedValue(null)
    expect(
      await getParameterSchema({
        descriptor: { askForParameters },
        game,
        player
      })
    ).toBeNull()
    expect(askForParameters).toHaveBeenCalledWith({ game, player })
  })

  it('handles invalid schema', async () => {
    askForParameters.mockResolvedValue([1, 2, 3])
    expect(
      await getParameterSchema({
        descriptor: { askForParameters },
        game,
        player
      })
    ).toBeNull()
    expect(askForParameters).toHaveBeenCalledWith({ game, player })
  })

  it('enriches image metadatas', async () => {
    expect(
      (
        await getParameterSchema({
          descriptor: {
            askForParameters: () => ({
              type: 'object',
              properties: {
                suite: {
                  type: 'string',
                  enum: ['clubs', 'spades'],
                  nullable: true,
                  metadata: {
                    images: {
                      clubs: 'clubs.png',
                      spades: 'spades.png'
                    }
                  }
                },
                side: {
                  type: 'string',
                  enum: ['white', 'black'],
                  nullable: true
                }
              }
            })
          },
          game,
          player
        })
      )?.schema.properties.suite.metadata.images
    ).toEqual({
      clubs: `/${kind}/images/clubs.png`,
      spades: `/${kind}/images/spades.png`
    })
  })

  it('does not enrich image absolute metadata', async () => {
    expect(
      (
        await getParameterSchema({
          descriptor: {
            askForParameters: () => ({
              type: 'object',
              properties: {
                suite: {
                  type: 'string',
                  enum: ['clubs', 'spades'],
                  nullable: true,
                  metadata: {
                    images: {
                      clubs: '/clubs.png',
                      spades: '#spades.png'
                    }
                  }
                }
              }
            })
          },
          game,
          player
        })
      )?.schema.properties.suite.metadata.images
    ).toEqual({
      clubs: `/clubs.png`,
      spades: `#spades.png`
    })
  })
})
