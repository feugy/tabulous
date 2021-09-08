import * as faker from 'faker'
import * as graphQL from '../../src/graphql'
import { deleteGame } from '../../src/stores/game-manager'
import { runMutation } from '../../src/stores/graphql-client'

jest.mock('../../src/stores/graphql-client')

describe('deleteGame', () => {
  it('deletes a game', async () => {
    const gameId = faker.datatype.uuid()
    expect(await deleteGame(gameId)).toBeUndefined()
    expect(runMutation).toHaveBeenCalledWith(graphQL.deleteGame, { gameId })
    expect(runMutation).toHaveBeenCalledTimes(1)
  })
})
