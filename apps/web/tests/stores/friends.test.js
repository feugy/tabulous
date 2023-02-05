import { faker } from '@faker-js/faker'
import * as graphQL from '@src/graphql'
import {
  acceptFriendship,
  endFriendship,
  listFriends,
  requestFriendship
} from '@src/stores/friends'
import {
  runMutation,
  runQuery,
  runSubscription
} from '@src/stores/graphql-client'
import { notify } from '@src/stores/notifications'
import { makeId, waitForObservable } from '@tests/test-utils'
import { Subject } from 'rxjs'
import { get } from 'svelte/store'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/graphql-client')
vi.mock('@src/stores/notifications')

const player = {
  id: faker.datatype.uuid(),
  username: faker.name.firstName()
}

beforeEach(() => vi.clearAllMocks())

describe('requestFriendship()', () => {
  it('sends mutation for a given player', async () => {
    expect(await requestFriendship(player)).toBeUndefined()
    expect(runMutation).toHaveBeenCalledWith(graphQL.requestFriendship, {
      id: player.id
    })
    expect(runMutation).toHaveBeenCalledOnce()
  })
})

describe('acceptFriendship()', () => {
  it('sends mutation for a given player', async () => {
    expect(await acceptFriendship(player)).toBeUndefined()
    expect(runMutation).toHaveBeenCalledWith(graphQL.acceptFriendship, {
      id: player.id
    })
    expect(runMutation).toHaveBeenCalledOnce()
  })
})

describe('endFriendship()', () => {
  it('sends mutation for a given player', async () => {
    expect(await endFriendship(player)).toBeUndefined()
    expect(runMutation).toHaveBeenCalledWith(graphQL.endFriendship, {
      id: player.id
    })
    expect(runMutation).toHaveBeenCalledOnce()
  })
})

describe('listFriends()', () => {
  const friendships = [
    { player: { id: makeId('p1'), username: 'Jeff' } },
    { player: { id: makeId('p2'), username: 'Danail' } },
    { player: { id: makeId('p3'), username: 'Kevin' }, isRequest: true },
    { player: { id: makeId('p4'), username: 'Paul' }, isRequest: true },
    { player: { id: makeId('p5'), username: 'Nick' }, isProposal: true }
  ]

  it('list sorted friends, requests and proposals', async () => {
    runQuery.mockResolvedValueOnce([...friendships])
    runSubscription.mockReturnValueOnce(new Subject())
    const list$ = listFriends()
    expect(get(list$)).toEqual([])

    expect(await waitForObservable(list$)).toEqual([
      friendships[1],
      friendships[0],
      friendships[2],
      friendships[4],
      friendships[3]
    ])

    expect(runQuery).toHaveBeenCalledWith(graphQL.listFriends, {}, false)
    expect(runQuery).toHaveBeenCalledOnce()
    expect(notify).not.toHaveBeenCalled()
  })

  describe('given a list of friends', () => {
    let list$
    const updates = new Subject()

    beforeEach(async () => {
      runQuery.mockResolvedValueOnce([...friendships])
      runSubscription.mockReturnValueOnce(updates)
      list$ = listFriends()
      await waitForObservable(list$)
    })

    it('updates list with accepted requests', async () => {
      const { player } = friendships[2]
      updates.next({ from: player, accepted: true })
      expect(await waitForObservable(list$)).toEqual([
        friendships[1],
        friendships[0],
        { player },
        friendships[4],
        friendships[3]
      ])
      expect(notify).toHaveBeenCalledWith({
        contentKey: 'labels.friendship-accepted',
        ...player
      })
      expect(notify).toHaveBeenCalledOnce()
    })

    it('updates list with declined requests', async () => {
      const { player } = friendships[3]
      updates.next({ from: player, declined: true })
      expect(await waitForObservable(list$)).toEqual([
        friendships[1],
        friendships[0],
        friendships[2],
        friendships[4]
      ])
      expect(notify).toHaveBeenCalledWith({
        contentKey: 'labels.friendship-declined',
        ...player
      })
      expect(notify).toHaveBeenCalledOnce()
    })

    it('updates list with new requests', async () => {
      const player = { id: makeId('p6'), username: 'John' }
      updates.next({ from: player, requested: true })
      expect(await waitForObservable(list$)).toEqual([
        friendships[1],
        friendships[0],
        { player, isRequest: true },
        friendships[2],
        friendships[4],
        friendships[3]
      ])
      expect(notify).toHaveBeenCalledWith({
        contentKey: 'labels.friendship-requested',
        ...player
      })
      expect(notify).toHaveBeenCalledOnce()
    })

    it('updates list with new proposals', async () => {
      const player = { id: makeId('p6'), username: 'John' }
      updates.next({ from: player, proposed: true })
      expect(await waitForObservable(list$)).toEqual([
        friendships[1],
        friendships[0],
        { player, isProposal: true },
        friendships[2],
        friendships[4],
        friendships[3]
      ])
      expect(notify).not.toHaveBeenCalled()
    })
  })
})