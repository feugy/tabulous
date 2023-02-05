import { BehaviorSubject } from 'rxjs'

import * as graphQL from '../graphql'
import { makeLogger } from '../utils'
import { runMutation, runQuery, runSubscription } from './graphql-client'
import { buildLocaleComparator } from './locale'
import { notify } from './notifications'

const logger = makeLogger('friends')

let listFriendsSubsciprion
let byUsername
buildLocaleComparator('player.username').subscribe(
  value => (byUsername = value)
)

/**
 * Fetches friend list and subscribes to friendship updates.
 * Returns immediately an empty observable, which will update when the list will be available, or updated.
 * @returns {Observable<Friendship[]>} an observable containing up-to-date list of friendships and requests.
 */
export function listFriends() {
  if (listFriendsSubsciprion) {
    listFriendsSubsciprion.unsubscribe()
  }
  const friends$ = new BehaviorSubject([])
  fetchFriendList(friends$)

  listFriendsSubsciprion = runSubscription(
    graphQL.receiveFriendshipUpdates
  ).subscribe(update => applyFriendshipUpdate(friends$, update))

  return friends$.asObservable()
}

/**
 * Request friendship with another player.
 * @param {Player} player - requested player.
 */
export async function requestFriendship(player) {
  logger.debug(`request friendship with ${player.username} (${player.id})`)
  await runMutation(graphQL.requestFriendship, { id: player.id })
}

/**
 * Accept friendship request from another player.
 * @param {Player} player - requesting player.
 */
export async function acceptFriendship(player) {
  logger.debug(
    `accept friendship request from ${player.username} (${player.id})`
  )
  await runMutation(graphQL.acceptFriendship, { id: player.id })
}

/**
 * Decline friendship request or ends friendship with another player.
 * @param {Player} player - declined player.
 */
export async function endFriendship(player) {
  logger.debug(`friendship ended with ${player.username} (${player.id})`)
  await runMutation(graphQL.endFriendship, { id: player.id })
}

async function fetchFriendList(list$) {
  logger.debug('fetch friends list')
  const friends = await runQuery(graphQL.listFriends, {}, false)
  logger.info(`received ${friends.length} friend(s) and request(s)`)
  list$.next(friends.sort(byUsername))
}

function applyFriendshipUpdate(list$, update) {
  logger.debug(update, 'processing friendship update')
  let notificationLabel = null
  if (update.requested || update.proposed) {
    list$.next(
      [
        ...list$.value,
        {
          player: update.from,
          isRequest: update.requested,
          isProposal: update.proposed
        }
      ].sort(byUsername)
    )
    if (update.requested) {
      notificationLabel = 'labels.friendship-requested'
    }
  } else if (update.accepted) {
    list$.next(
      list$.value.map(friendship =>
        friendship.player.id === update.from.id
          ? { player: friendship.player }
          : friendship
      )
    )
    notificationLabel = 'labels.friendship-accepted'
  } else if (update.declined) {
    list$.next(
      list$.value.filter(friendship => friendship.player.id !== update.from.id)
    )
    notificationLabel = 'labels.friendship-declined'
  }
  if (notificationLabel) {
    notify({ contentKey: notificationLabel, ...update.from })
  }
}