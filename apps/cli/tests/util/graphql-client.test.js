// @ts-check
import { faker } from '@faker-js/faker'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/util/configuration.js', () => ({
  loadConfiguration: vi.fn()
}))

describe('getGraphQLClient()', () => {
  /** @type {import('vitest').MockedFunction<import('@src/util/configuration').loadConfiguration>} */
  let loadConfiguration
  /** @type {import('@src/util/graphql-client').getGraphQLClient} */
  let getGraphQLClient
  const url = faker.internet.url({ appendSlash: false })
  const jwtKey = faker.string.uuid()

  beforeAll(async () => {
    loadConfiguration = vi.mocked(
      (await import('../../src/util/configuration.js')).loadConfiguration
    )
    ;({ getGraphQLClient } = await import('../../src/util/graphql-client.js'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds client from configuration', () => {
    loadConfiguration.mockReturnValue({
      url,
      jwt: { key: jwtKey },
      adminUserId: ''
    })

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
    /** @type {import('@src/util').Client} */
    let client
    /** @type {MockAgent} */
    let mockAgent
    /** @type {ReturnType<MockAgent['get']>} */
    let networkMock
    const graphQLRequest = vi.fn()

    beforeAll(() => {
      client = getGraphQLClient()
      mockAgent = new MockAgent()
      mockAgent.disableNetConnect()
      setGlobalDispatcher(mockAgent)
      networkMock = mockAgent.get(url)
    })

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('throws returned errors', async () => {
      const error = new Error('boom')
      const username = faker.person.fullName()
      const jwt = faker.string.uuid()

      networkMock
        .intercept({ method: 'POST', path: '/' })
        .reply(200, ({ headers, body }) => {
          graphQLRequest({
            body: JSON.parse(/** @type {string} */ (body)),
            headers
          })
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
      const username = faker.person.fullName()
      const jwt = faker.string.uuid()
      const data = {
        searchPlayers: [
          { id: faker.string.uuid(), name: faker.person.fullName() }
        ]
      }

      networkMock
        .intercept({ method: 'POST', path: '/' })
        .reply(200, ({ headers, body }) => {
          graphQLRequest({
            body: JSON.parse(/** @type {string} */ (body)),
            headers
          })
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
      const username = faker.person.fullName()
      const jwt = faker.string.uuid()
      const data = {
        addNewUser: [{ id: faker.string.uuid(), name: faker.person.fullName() }]
      }

      networkMock
        .intercept({ method: 'POST', path: '/' })
        .reply(200, ({ headers, body }) => {
          graphQLRequest({
            body: JSON.parse(/** @type {string} */ (body)),
            headers
          })
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
