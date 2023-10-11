// @ts-check
import { findMesh, snapTo, stackMeshes } from '@tabulous/game-utils'
import { buildDescriptorTestSuite } from '@tabulous/game-utils/tests/game.js'
import { beforeEach, describe, expect, it } from 'vitest'

import * as descriptor from '.'
import { blackId, ids, whiteId } from './logic/constants.js'

buildDescriptorTestSuite('draughts', descriptor, utils => {
  describe('computeScore', () => {
    const player = utils.makePlayer(0)
    const player2 = utils.makePlayer(1)
    /** @type {import('@tabulous/types').Mesh[]} */
    let meshes

    beforeEach(async () => {
      ;({ meshes } = await utils.buildGame({
        ...descriptor,
        name: utils.name
      }))
    })

    it('computes on snap', async () => {
      const pawn = findMesh(`${blackId}-1`, meshes)
      snapTo(ids.scoreAnchor, pawn, meshes)
      expect(
        descriptor.computeScore(
          {
            fn: 'snap',
            args: [pawn.id, ids.scoreAnchor, true],
            fromHand: false,
            meshId: pawn.id
          },
          { meshes, handMeshes: [], history: [] },
          [player],
          [{ playerId: player.id, side: whiteId }]
        )
      ).toEqual({ [player.id]: { total: 1 } })
    })

    it('computes on unsnap', async () => {
      const pawn1 = findMesh(`${blackId}-1`, meshes)
      const pawn2 = findMesh(`${blackId}-2`, meshes)
      const pawn3 = findMesh(`${whiteId}-1`, meshes)
      snapTo(ids.scoreAnchor, pawn1, meshes)
      snapTo(ids.scoreAnchor, pawn2, meshes)
      snapTo(ids.scoreAnchor, pawn3, meshes)
      expect(
        descriptor.computeScore(
          {
            fn: 'unsnap',
            args: [pawn1.id, ids.scoreAnchor],
            fromHand: false,
            meshId: pawn1.id
          },
          { meshes, handMeshes: [], history: [] },
          [player, player2],
          [
            { playerId: player.id, side: whiteId },
            { playerId: player2.id, side: blackId }
          ]
        )
      ).toEqual({ [player.id]: { total: 2 }, [player2.id]: { total: 1 } })
    })

    it('computes on push', async () => {
      const pawn1 = findMesh(`${blackId}-1`, meshes)
      const pawn2 = findMesh(`${blackId}-2`, meshes)
      snapTo(ids.scoreAnchor, pawn1, meshes)
      stackMeshes([pawn1, pawn2])
      expect(
        descriptor.computeScore(
          {
            fn: 'push',
            args: [pawn2.id, true],
            fromHand: false,
            meshId: pawn1.id
          },
          { meshes, handMeshes: [], history: [] },
          [player, player2],
          [
            { playerId: player.id, side: whiteId },
            { playerId: player2.id, side: blackId }
          ]
        )
      ).toEqual({ [player.id]: { total: 2 }, [player2.id]: { total: 0 } })
    })

    it.each([
      {
        fn: /** @type {const} */ ('snap'),
        args: [`${blackId}-1`, `${ids.pawnAnchor}-0-0`, true]
      },
      {
        fn: /** @type {const} */ ('unsnap'),
        args: [`${blackId}-1`, `${ids.pawnAnchor}-0-0`, true]
      }
    ])('ignores $fn outside the score anchor', async ({ fn, args }) => {
      const pawn = findMesh(`${blackId}-1`, meshes)
      snapTo(ids.scoreAnchor, pawn, meshes)
      expect(
        descriptor.computeScore(
          { fn, args, fromHand: false, meshId: pawn.id },
          { meshes, handMeshes: [], history: [] },
          [player],
          [{ playerId: player.id, side: whiteId }]
        )
      ).toBeUndefined()
    })
  })
})
