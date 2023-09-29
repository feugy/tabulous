// @ts-check
import {
  buildCameraPosition,
  findAnchor,
  pop,
  snapTo
} from '@tabulous/game-utils'

import { anchorIds, counts } from './constants.js'

/** @type {import('@tabulous/types').AddPlayer<?>} */
export function addPlayer(game, player) {
  game.cameras.push(
    buildCameraPosition({
      playerId: player.id,
      target: [0, 0, -2],
      elevation: 30
    })
  )

  const reserveId =
    findAnchor(anchorIds.reserve, game.meshes)?.snappedId ?? 'reserve-not-found'

  for (let column = 0; column < counts.columns; column++) {
    const anchorId = `${anchorIds.column}-${column + 1}`
    const thread =
      /** @type {(import('@tabulous/types').Mesh & {flippable: import('@tabulous/types').FlippableState})[]} */ (
        pop(reserveId, column + 1, game.meshes)
      )
    for (
      let parent = thread[0], i = 1;
      i < thread.length;
      parent = thread[i++]
    ) {
      snapTo(`${parent.id}-bottom`, thread[i], thread)
    }
    thread[thread.length - 1].flippable.isFlipped = false
    snapTo(anchorId, thread[0], game.meshes)
  }

  return game
}
