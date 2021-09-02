import faker from 'faker'
import { players } from '../../src/repositories/players.js'

describe('given a connected repository and several players', () => {
  const models = [
    { id: faker.datatype.uuid(), username: 'Jane' },
    { id: faker.datatype.uuid(), username: 'Paul' },
    { id: faker.datatype.uuid(), username: 'Andrew' }
  ]

  beforeEach(async () => {
    await players.connect()
    await players.save(models)
  })

  afterEach(() => players.connect())

  describe('Player repository', () => {
    describe('getByUsername()', () => {
      it('returns a player by username', async () => {
        const model = faker.random.arrayElement(models)
        expect(await players.getByUsername(model.username)).toEqual(model)
      })

      it('returns null on unknown unsername', async () => {
        expect(await players.getByUsername(faker.name.firstName())).toBeNull()
      })
    })
  })
})
