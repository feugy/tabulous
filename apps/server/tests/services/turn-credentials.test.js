import { faker } from '@faker-js/faker'
import { createHmac } from 'crypto'

import { generateTurnCredentials } from '../../src/services/turn-credentials'

describe('generateTurnCredentials()', () => {
  it('generates compliant credentials for the next 12 hours', async () => {
    const secret = faker.lorem.word()
    const now = Math.floor(new Date().getTime() / 1000)

    // see https://github.com/coturn/coturn/blob/upstream/4.5.2/README.turnserver#L180-L193
    const username = `${now + 12 * 60 * 60}`
    const credentials = Buffer.from(
      createHmac('sha1', secret).update(username).digest()
    ).toString('base64')

    expect(await generateTurnCredentials(secret)).toEqual({
      username,
      credentials
    })
  })
})
