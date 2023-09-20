// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 */

import { faker } from '@faker-js/faker'
import { DrawBehavior, DrawBehaviorName } from '@src/3d/behaviors'
import { createCard } from '@src/3d/meshes'
import { altitudeGap, createTable } from '@src/3d/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectAnimationEnd,
  expectDisposed,
  expectNotDisposed,
  expectPosition,
  sleep,
  waitForLayout
} from '../../test-utils'

/** @type {Scene} */
let scene
/** @type {Scene} */
let handScene
/** @type {import('@src/3d/managers').Managers} */
let managers
/** @type {string} */
let playerId
const actionRecorded = vi.fn()
const animationEndReceived = vi.fn()

configures3dTestEngine(created => {
  scene = created.scene
  handScene = created.handScene
  managers = created.managers
  playerId = created.playerId
  managers.control.onActionObservable.add(actionRecorded)
  managers.hand.enabled = true
})

beforeEach(() => {
  vi.clearAllMocks()
  createTable({}, managers, scene)
})

describe('DrawBehavior', () => {
  it('has initial state', () => {
    const state = {
      duration: faker.number.int(999),
      unflipOnPick: faker.datatype.boolean(),
      flipOnPlay: faker.datatype.boolean(),
      angleOnPick: faker.number.int(1) * Math.PI
    }
    const behavior = new DrawBehavior(state, managers)
    const mesh = createBox('box', {})

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(DrawBehaviorName)

    mesh.addBehavior(behavior, true)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toEqual(mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new DrawBehavior({}, managers).fromState({})).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not draw in hand without mesh', () => {
    const behavior = new DrawBehavior({}, managers)
    behavior.draw?.()
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const behavior = new DrawBehavior({}, managers)
    const mesh = createBox('box', {})
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.state).toEqual({
      duration: 750,
      unflipOnPick: true,
      flipOnPlay: false,
      angleOnPick: 0
    })
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.metadata.draw).toBeInstanceOf(Function)
  })

  describe('given attached to a mesh', () => {
    /** @type {Mesh} */
    let mesh
    /** @type {DrawBehavior} */
    let behavior
    /** @type {Mesh} */
    let handMesh

    beforeEach(async () => {
      mesh = createCard(
        {
          id: 'box',
          texture: '',
          drawable: { flipOnPlay: true, angleOnPick: 0 },
          rotable: {},
          flippable: {},
          stackable: { kinds: ['box'] },
          movable: { kind: 'box' }
        },
        managers,
        scene
      )
      behavior = /** @type {DrawBehavior} */ (
        mesh.getBehaviorByName(DrawBehaviorName)
      )
      mesh.onAnimationEnd.add(animationEndReceived)
      handMesh = createCard(
        {
          id: 'hand-box',
          texture: '',
          drawable: { flipOnPlay: true, angleOnPick: 0 },
          rotable: {},
          flippable: {},
          stackable: { kinds: ['box'] },
          movable: { kind: 'box' }
        },
        managers,
        handScene
      )
      await waitForLayout(managers.hand)
    })

    it('can hydrate from state', () => {
      const state = {
        duration: faker.number.int(999),
        unflipOnPick: faker.datatype.boolean(),
        flipOnPlay: faker.datatype.boolean(),
        angleOnPick: faker.number.int(1) * Math.PI
      }
      behavior.fromState(state)
      expect(behavior.state).toEqual(state)
      expect(behavior.mesh).toEqual(mesh)
      expect(actionRecorded).not.toHaveBeenCalled()
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          draw: expect.any(Function)
        })
      )
    })

    it('is drawable only when beeing on the table', () => {
      expect(mesh.metadata.drawable).toBe(true)
      expect(handMesh.metadata.drawable).toBe(false)
    })

    it('is playable only when beeing in hand', () => {
      expect(mesh.metadata.playable).toBe(false)
      expect(handMesh.metadata.playable).toBe(true)
    })

    it(`draws into player's hand`, async () => {
      const state = mesh.metadata.serialize()
      mesh.metadata.draw?.()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: mesh.id,
          fn: 'draw',
          args: [state, playerId],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      await expectAnimationEnd(behavior)
      expect(animationEndReceived).toHaveBeenCalledOnce()
      expectDisposed(scene, mesh)
      expectNotDisposed(handScene, mesh)
    })

    it(`draws into another player's hand`, async () => {
      const state = mesh.metadata.serialize()
      const anotherPlayerId = 'another-player-id'
      mesh.metadata.draw?.(state, anotherPlayerId)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: mesh.id,
          fn: 'draw',
          args: [state, anotherPlayerId],
          fromHand: false,
          isLocal: true
        },
        expect.anything()
      )
      await expectAnimationEnd(behavior)
      expect(animationEndReceived).toHaveBeenCalledOnce()
      expectDisposed(scene, mesh)
      expectDisposed(handScene, mesh)
    })

    it(`plays to the table`, async () => {
      mesh.dispose()
      handMesh.metadata.play?.()
      const created = /** @type {Mesh} */ (scene.getMeshById(handMesh.id))
      const state = created.metadata.serialize()
      const createdBehavior = created.getBehaviorByName(DrawBehaviorName)
      await Promise.all([
        waitForLayout(managers.hand),
        expectAnimationEnd(createdBehavior)
      ])
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: created.id,
          fn: 'play',
          args: [{ ...state, y: altitudeGap * 0.5 }, playerId],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      expectDisposed(handScene, handMesh)
    })

    it(`stacks when playing to the table`, async () => {
      handMesh.metadata.play?.()
      const created = /** @type {Mesh} */ (scene.getMeshById(handMesh.id))
      const position = created.absolutePosition.asArray()
      const state = created.metadata.serialize()
      const createdBehavior = created.getBehaviorByName(DrawBehaviorName)
      await Promise.all([
        waitForLayout(managers.hand),
        expectAnimationEnd(createdBehavior)
      ])
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(
        1,
        {
          meshId: created.id,
          fn: 'play',
          args: [
            {
              ...state,
              x: mesh.absolutePosition.x,
              y: altitudeGap * 2,
              z: mesh.absolutePosition.z
            },
            playerId
          ],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenNthCalledWith(
        2,
        {
          meshId: mesh.id,
          fn: 'push',
          duration: 0,
          args: [created.id, true],
          revert: [1, true, position, 0],
          fromHand: false,
          isLocal: true
        },
        expect.anything()
      )
      expectDisposed(handScene, handMesh)
    })

    it('can revert played to main', async () => {
      mesh.dispose()
      const state = handMesh.metadata.serialize()
      handMesh.metadata.play?.()
      expectDisposed(handScene, handMesh)
      const created = /** @type {Mesh} */ (scene.getMeshById(handMesh.id))
      const position = created.absolutePosition.asArray()
      const createdBehavior = created.getBehaviorByName(DrawBehaviorName)
      await Promise.all([
        waitForLayout(managers.hand),
        expectAnimationEnd(createdBehavior)
      ])
      expectNotDisposed(scene, created)
      animationEndReceived.mockClear()
      actionRecorded.mockClear()

      await Promise.all([
        createdBehavior?.revert('play', [state, playerId]),
        expectAnimationEnd(createdBehavior),
        waitForLayout(managers.hand)
      ])
      const reverted = handScene.getMeshById(handMesh.id)
      expectDisposed(scene, handMesh)
      expectNotDisposed(handScene, handMesh)
      expect(reverted?.metadata.serialize()).toEqual(state)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: handMesh.id,
          fn: 'draw',
          args: [
            {
              ...state,
              flippable: { ...state.flippable, isFlipped: true },
              x: position[0],
              z: position[2]
            },
            playerId
          ],
          fromHand: false,
          isLocal: true
        },
        expect.anything()
      )
    })

    it('elevates and fades out mesh when animating from main to hand', async () => {
      const { x, y, z } = mesh.absolutePosition
      expect(mesh.visibility).toEqual(1)
      await behavior.animateToHand()
      expectPosition(mesh, [x, y + 3, z])
      expect(mesh.visibility).toEqual(0)
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('can not animate while animating', async () => {
      behavior.animateToHand()
      behavior.animateToMain()
      behavior.animateToHand()
      behavior.animateToMain()
      await sleep(behavior.state.duration * 2)
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('descend and fades in mesh when animating from hand to main', async () => {
      const position = mesh.absolutePosition.asArray()
      await behavior.animateToMain()
      expectPosition(mesh, position)
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })
  })
})
