// @ts-check
import { faker } from '@faker-js/faker'
import stripAnsi from 'strip-ansi'
import { describe, expect, it } from 'vitest'

import { formatDate, formatGame, formatPlayer } from '../../src/util/formaters'

describe('formatGame()', () => {
  it('prints game kind, creation date and id', () => {
    const game = {
      id: faker.string.uuid(),
      created: faker.date.recent().getTime(),
      kind: 'klondike'
    }
    expect(stripAnsi(formatGame(game))).toEqual(
      `${game.kind} game ${formatDate(game.created)} (${game.id})`
    )
  })

  it('prints lobby and id', () => {
    const game = {
      id: faker.string.uuid(),
      created: faker.date.recent().getTime()
    }
    expect(stripAnsi(formatGame(game))).toEqual(
      `🛋️ lobby ${formatDate(game.created)} (${game.id})`
    )
  })
})

describe('formatDate()', () => {
  function pad(/** @type {number} */ number) {
    return number < 10 ? `0${number}` : number.toString()
  }
  it('handles no date', () => {
    expect(formatDate()).toEqual('unknown')
  })

  it('prints date and time', () => {
    const date = new Date()
    expect(formatDate(date.getTime())).toEqual(
      `${pad(date.getDate())}/${pad(
        date.getMonth() + 1
      )}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(
        date.getMinutes()
      )}:${pad(date.getSeconds())}`
    )
  })
})

describe('formatPlayer()', () => {
  it('prints username, email and id', () => {
    const id = faker.string.uuid()
    const email = faker.internet.email()
    const username = faker.person.fullName()
    expect(
      stripAnsi(formatPlayer({ username, email, id, currentGameId: null }))
    ).toEqual(`${username} ${email} (${id})`)
  })

  it('handles no email', () => {
    const id = faker.string.uuid()
    const username = faker.person.fullName()
    expect(
      stripAnsi(formatPlayer({ username, id, currentGameId: null }))
    ).toEqual(`${username} no email (${id})`)
  })
})
