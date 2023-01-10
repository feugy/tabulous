import { faker } from '@faker-js/faker'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/util/configuration.js', () => ({
  loadConfiguration: vi.fn()
}))

describe('getGraphQLClient()', () => {
  let loadConfiguration
  let getGraphQLClient
  const url = faker.internet.url()
  const jwtKey = faker.datatype.uuid()

  beforeAll(async () => {
    ;({ loadConfiguration } = await import('../../src/util/configuration.js'))
    ;({ getGraphQLClient } = await import('../../src/util/graphql-client.js'))
  })

  beforeEach(vi.clearAllMocks)

  it('builds client from configuration', () => {
    loadConfiguration.mockReturnValue({ url, jwt: { key: jwtKey } })

    const client = getGraphQLClient()
    expect(client).toBeDefined()
    expect(loadConfiguration).toHaveBeenCalledOnce()
  })

  it('reuses existing client', () => {
    const client = getGraphQLClient()
    expect(client).toBeDefined()
    expect(loadConfiguration).not.toHaveBeenCalled()
  })

  describe('given a client', () => {
    let client
    let mockAgent
    let networkMock
    const graphQLRequest = vi.fn()

    beforeAll(() => {
      client = getGraphQLClient()
      mockAgent = new MockAgent()
      mockAgent.disableNetConnect()
      setGlobalDispatcher(mockAgent)
      networkMock = mockAgent.get(url)
    })

    beforeEach(vi.clearAllMocks)

    it('throws returned errors', async () => {
      const error = new Error('boom')
      const username = faker.name.fullName()
      const jwt = faker.datatype.uuid()

      networkMock
        .intercept({ method: 'POST', path: '/' })
        .reply(200, ({ headers, body }) => {
          graphQLRequest({ body: JSON.parse(body), headers })
          return { errors: [{ message: error.message }], data: null }
        })

      await expect(
        client.query(
          `query findUserByUsername($username: String!) {
          searchPlayers(search: $username) { id, username }
        }`,
          { username },
          jwt
        )
      ).rejects.toThrow(error.message)
    })

    it('runs query', async () => {
      const username = faker.name.fullName()
      const jwt = faker.datatype.uuid()
      const data = {
        searchPlayers: [
          { id: faker.datatype.uuid(), name: faker.name.fullName() }
        ]
      }

      networkMock
        .intercept({ method: 'POST', path: '/' })
        .reply(200, ({ headers, body }) => {
          graphQLRequest({ body: JSON.parse(body), headers })
          return { data }
        })

      expect(
        await client.query(
          `query findUserByUsername($username: String!) {
          searchPlayers(search: $username) { id, username }
        }`,
          { username },
          jwt
        )
      ).toEqual(data)
      expect(graphQLRequest).toHaveBeenCalledWith({
        body: {
          operationName: 'findUserByUsername',
          query: `query findUserByUsername($username: String!) {
  searchPlayers(search: $username) {
    id
    username
    __typename
  }
}`,
          variables: { username }
        },
        headers: expect.objectContaining({
          authorization: `Bearer ${jwt}`
        })
      })
    })

    it('runs mutation', async () => {
      const username = faker.name.fullName()
      const jwt = faker.datatype.uuid()
      const data = {
        addNewUser: [{ id: faker.datatype.uuid(), name: faker.name.fullName() }]
      }

      networkMock
        .intercept({ method: 'POST', path: '/' })
        .reply(200, ({ headers, body }) => {
          graphQLRequest({ body: JSON.parse(body), headers })
          return { data }
        })

      expect(
        await client.mutation(
          `mutation addNewUser($username: String!) {
          addUser(search: $username) { id, username }
        }`,
          { username },
          jwt
        )
      ).toEqual(data)
      expect(graphQLRequest).toHaveBeenCalledWith({
        body: {
          operationName: 'addNewUser',
          query: `mutation addNewUser($username: String!) {
  addUser(search: $username) {
    id
    username
    __typename
  }
}`,
          variables: { username }
        },
        headers: expect.objectContaining({
          authorization: `Bearer ${jwt}`
        })
      })
    })
  })
})
