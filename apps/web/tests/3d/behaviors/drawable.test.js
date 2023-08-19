// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 */

import { faker } from '@faker-js/faker'
import { DrawBehavior, DrawBehaviorName } from '@src/3d/behaviors'
import { controlManager, handManager } from '@src/3d/managers'
import { createCard } from '@src/3d/meshes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectAnimationEnd,
  expectPosition,
  sleep
} from '../../test-utils'

/** @type {Scene} */
let scene
const actionRecorded = vi.fn()
const animationEndReceived = vi.fn()
const handOverlay = document.createElement('div')

configures3dTestEngine(created => {
  scene = created.scene
  handManager.init({ ...created, overlay: handOverlay })
  controlManager.onActionObservable.add(actionRecorded)
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('DrawBehavior', () => {
  it('has initial state', () => {
    const state = {
      duration: faker.number.int(999),
      unflipOnPick: faker.datatype.boolean(),
      flipOnPlay: faker.datatype.boolean(),
      angleOnPick: faker.number.int(1) * Math.PI
    }
    const behavior = new DrawBehavior(state)
    const mesh = createBox('box', {})

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(DrawBehaviorName)

    mesh.addBehavior(behavior, true)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toEqual(mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new DrawBehavior().fromState({})).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not draw in hand without mesh', () => {
    const behavior = new DrawBehavior()
    behavior.draw?.()
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const behavior = new DrawBehavior()
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

    beforeEach(() => {
      mesh = createCard({ id: 'box', texture: '', drawable: {} }, scene)
      behavior = /** @type {DrawBehavior} */ (
        mesh.getBehaviorByName(DrawBehaviorName)
      )
      mesh.onAnimationEnd.add(animationEndReceived)
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

    it(`draws into player's hand`, async () => {
      const { x, ...state } = mesh.metadata.serialize() // eslint-disable-line no-unused-vars
      mesh.metadata.draw?.()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: mesh.id,
          fn: 'draw',
          args: [{ x: expect.any(Number), ...state }],
          fromHand: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      await expectAnimationEnd(behavior)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('elevates and fades out mesh when animating from main to hand', async () => {
      const { x, y, z } = mesh.absolutePosition
      expect(mesh.visibility).toEqual(1)
      await behavior.animateToHand()
      expectPosition(mesh, [x, y + 3, z])
      expect(mesh.visibility).toEqual(0)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('can not animate while animating', async () => {
      behavior.animateToHand()
      behavior.animateToMain()
      behavior.animateToHand()
      behavior.animateToMain()
      await sleep(behavior.state.duration * 2)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('descend and fades in mesh when animating from hand to main', async () => {
      const position = mesh.absolutePosition.asArray()
      await behavior.animateToMain()
      expectPosition(mesh, position)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })
  })
})
