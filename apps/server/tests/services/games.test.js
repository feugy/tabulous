import faker from 'faker'
import { createGame } from '@src/services/games.js'

describe('createGame()', () => {
  it('throws an error on unknown game', async () => {
    const kind = faker.lorem.word()
    const playerId = faker.datatype.uuid()
    await expect(createGame(kind, playerId)).rejects.toThrow(
      `Unsupported game ${kind}`
    )
  })

  it('loads a supported game from descriptor', async () => {
    const kind = 'splendor'
    const playerId = faker.datatype.uuid()
    expect(await createGame(kind, playerId)).toEqual({
      id: expect.any(String),
      created: expect.any(Number),
      kind,
      playerIds: [playerId],
      scene: {
        cards: expect.any(Array),
        roundTokens: expect.any(Array),
        roundedTiles: expect.any(Array)
      }
    })
  })
})
