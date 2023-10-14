// @ts-check
import { findMesh, snapTo, unsnap } from '@tabulous/game-utils'
import {
  buildDescriptorTestSuite,
  buildParameters,
  enroll,
  toEngineState
} from '@tabulous/game-utils/tests/game.js'
import { beforeEach, describe, expect, it } from 'vitest'

import * as descriptor from '.'
import { ids } from './logic/constants.js'

buildDescriptorTestSuite('mah-jong', descriptor, utils => {
  describe('computeScore', () => {
    const player = utils.makePlayer(0)
    const player2 = utils.makePlayer(1)
    /** @type {import('@tabulous/types').StartedGame} */
    let game

    beforeEach(async () => {
      game = await utils.buildGame({
        ...descriptor,
        name: utils.name
      })
      game = await enroll(
        descriptor,
        game,
        player,
        buildParameters(await descriptor.askForParameters({ game, player }))
      )
      game = await enroll(
        descriptor,
        game,
        player2,
        buildParameters(
          await descriptor.askForParameters({ game, player: player2 })
        )
      )
    })

    it('computes initial score', async () => {
      expect(
        descriptor.computeScore(
          null,
          toEngineState(game),
          [player, player2],
          []
        )
      ).toEqual({
        [player.id]: { total: '25k' },
        [player2.id]: { total: '25k' }
      })
    })

    it('computes on snap', async () => {
      const stick = unsnap(`${ids.score}0`, game.meshes)
      const anchorId = `${ids.score}1`
      snapTo(anchorId, stick, game.meshes)
      expect(
        descriptor.computeScore(
          {
            fn: 'snap',
            args: [stick.id, anchorId, true],
            fromHand: false,
            meshId: stick.id
          },
          toEngineState(game),
          [player, player2],
          []
        )
      ).toEqual({
        [player.id]: { total: '24k' },
        [player2.id]: { total: '26k' }
      })
    })

    it('computes on unsnap', async () => {
      const anchorId = `${ids.score}0`
      const stick = unsnap(anchorId, game.meshes)
      expect(
        descriptor.computeScore(
          {
            fn: 'unsnap',
            args: [stick.id, anchorId, true],
            fromHand: false,
            meshId: stick.id
          },
          toEngineState(game),
          [player],
          []
        )
      ).toEqual({ [player.id]: { total: '24k' } })
    })

    it('computes on increment', async () => {
      const stick1 = unsnap(`${ids.score}0`, game.meshes)
      const stick2 = findMesh(`stick-100-1`, game.meshes)
      // @ts-expect-error -- can not use ! operator in JS.
      stick2.quantifiable.quantity += stick1.quantifiable?.quantity ?? 1
      expect(
        descriptor.computeScore(
          {
            fn: 'increment',
            args: [[], true],
            fromHand: false,
            meshId: stick2.id
          },
          toEngineState(game),
          [player, player2],
          []
        )
      ).toEqual({
        [player.id]: { total: '24k' },
        [player2.id]: { total: '26k' }
      })
    })

    it('computes on decrement', async () => {
      const stick = findMesh(`stick-1000-0`, game.meshes)
      // @ts-expect-error -- can not use ! operator in JS.
      stick.quantifiable.quantity -= 2
      expect(
        descriptor.computeScore(
          {
            fn: 'decrement',
            args: [2, true, `stick-1000-0-whatever`],
            fromHand: false,
            meshId: stick.id
          },
          toEngineState(game),
          [player],
          []
        )
      ).toEqual({
        [player.id]: { total: '23k' }
      })
    })

    it.each([
      { fn: /** @type {const} */ ('snap') },
      { fn: /** @type {const} */ ('unsnap') }
    ])('ignores $fn outside the score anchor', async ({ fn }) => {
      const tile = findMesh(`man-1-1`, game.meshes)
      const anchorId = `river-east-1-1`
      snapTo(anchorId, tile, game.meshes)
      expect(
        descriptor.computeScore(
          {
            fn,
            args: [tile.id, anchorId, true],
            fromHand: false,
            meshId: tile.id
          },
          toEngineState(game),
          [player],
          []
        )
      ).toBeUndefined()
    })
  })
})
