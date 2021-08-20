import faker from 'faker'
import { createGame, deleteGame, loadGame } from '@src/services/games.js'

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

describe('deleteGame()', () => {
  it('returns null on unknown game', async () => {
    expect(
      await deleteGame(faker.datatype.uuid(), faker.datatype.uuid())
    ).toBeNull()
  })

  describe('given an existing game', () => {
    let game
    const playerId = faker.datatype.uuid()

    beforeEach(async () => {
      game = await createGame('splendor', playerId)
    })

    // TODO delete afterEach

    it('returns null when on un-owned game', async () => {
      expect(await deleteGame(game.id, faker.datatype.uuid())).toBeNull()
      expect(await loadGame(game.id, playerId)).toBeDefined()
    })

    it('returns deleted game', async () => {
      expect(await deleteGame(game.id, playerId)).toEqual(game)
      expect(await loadGame(game.id, playerId)).toBeNull()
    })
  })
})
