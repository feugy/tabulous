import * as faker from 'faker'
import * as graphQL from '../../src/graphql'
import { searchPlayers } from '../../src/stores/players'
import { runQuery } from '../../src/stores/graphql-client'

jest.mock('../../src/stores/graphql-client')

describe('searchPlayers()', () => {
  it('search players by user name', async () => {
    const username = faker.name.firstName()
    expect(await searchPlayers(username)).toBeUndefined()
    expect(runQuery).toHaveBeenCalledWith(graphQL.searchPlayers, {
      search: username
    })
    expect(runQuery).toHaveBeenCalledTimes(1)
  })
})
