// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 */

import {
  DetailBehaviorName,
  DrawBehaviorName,
  FlipBehaviorName,
  LockBehaviorName,
  QuantityBehaviorName,
  RandomBehaviorName,
  RotateBehaviorName,
  StackBehaviorName
} from '@src/3d/behaviors'
import { actionNames, buildActionNamesByKey } from '@src/3d/utils/actions'
import { describe, expect, it } from 'vitest'

const {
  decrement,
  detail,
  draw,
  flip,
  increment,
  play,
  pop,
  push,
  random,
  reorder,
  rotate,
  toggleLock
} = actionNames

describe('buildActionNamesByKey()', () => {
  const translate = (/** @type {string} */ key) => key

  it('returns no actions when no mesh is given', () => {
    expect(buildActionNamesByKey([], translate)).toEqual(new Map())
  })

  it.each([
    { action: flip, behavior: FlipBehaviorName },
    { action: random, behavior: RandomBehaviorName },
    { action: rotate, behavior: RotateBehaviorName },
    { action: detail, behavior: DetailBehaviorName },
    { action: toggleLock, behavior: LockBehaviorName }
  ])('can return $behavior action', ({ behavior, action }) => {
    expect(
      buildActionNamesByKey(
        [{ shape: 'box', id: '', texture: '', [behavior]: {} }],
        translate
      )
    ).toEqual(new Map([[`shortcuts.${action}`, [action]]]))
  })

  it(`can return '${StackBehaviorName}' actions only`, () => {
    expect(
      buildActionNamesByKey(
        [{ shape: 'box', id: '', texture: '', [StackBehaviorName]: {} }],
        translate
      )
    ).toEqual(
      new Map([
        [`shortcuts.pop`, [pop]],
        [`shortcuts.push`, [push]],
        [`shortcuts.reorder`, [reorder]]
      ])
    )
  })

  it(`can return '${QuantityBehaviorName}' actions only`, () => {
    expect(
      buildActionNamesByKey(
        [{ shape: 'box', id: '', texture: '', [QuantityBehaviorName]: {} }],
        translate
      )
    ).toEqual(
      new Map([
        [`shortcuts.pop`, [decrement]],
        [`shortcuts.push`, [increment]]
      ])
    )
  })

  it(`can return both '${QuantityBehaviorName}' and '${StackBehaviorName}' actions`, () => {
    expect(
      buildActionNamesByKey(
        [
          {
            shape: 'box',
            id: '',
            texture: '',
            [QuantityBehaviorName]: {},
            [StackBehaviorName]: {}
          }
        ],
        translate
      )
    ).toEqual(
      new Map([
        [`shortcuts.pop`, [pop, decrement]],
        [`shortcuts.push`, [push, increment]],
        [`shortcuts.reorder`, [reorder]]
      ])
    )
  })

  it(`can return all actions`, () => {
    expect(
      buildActionNamesByKey(
        [
          {
            shape: 'box',
            id: '',
            texture: '',
            [FlipBehaviorName]: {},
            [RotateBehaviorName]: {},
            [DetailBehaviorName]: { frontImage: '' },
            [DrawBehaviorName]: {},
            [LockBehaviorName]: {},
            [RandomBehaviorName]: {},
            [QuantityBehaviorName]: {},
            [StackBehaviorName]: {}
          }
        ],
        translate
      )
    ).toEqual(
      new Map([
        [`shortcuts.flip`, [flip]],
        [`shortcuts.rotate`, [rotate]],
        [`shortcuts.drawOrPlay`, [draw, play]],
        [`shortcuts.detail`, [detail]],
        [`shortcuts.random`, [random]],
        [`shortcuts.toggleLock`, [toggleLock]],
        [`shortcuts.pop`, [pop, decrement]],
        [`shortcuts.push`, [push, increment]],
        [`shortcuts.reorder`, [reorder]]
      ])
    )
  })
})
