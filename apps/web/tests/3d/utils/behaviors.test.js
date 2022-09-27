import { Animation } from '@babylonjs/core/Animations/animation'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import {
  AnchorBehaviorName,
  DetailBehaviorName,
  DrawBehaviorName,
  FlipBehaviorName,
  LockBehaviorName,
  MoveBehaviorName,
  RotateBehaviorName,
  StackBehaviorName
} from '../../../src/3d/behaviors/names'
import {
  animateMove,
  attachFunctions,
  attachProperty,
  getAnimatableBehavior,
  getTargetableBehavior,
  isMeshFlipped,
  isMeshInverted,
  registerBehaviors,
  restoreBehaviors,
  runAnimation,
  serializeBehaviors
} from '../../../src/3d/utils/behaviors'
import {
  disposeAllMeshes,
  expectPosition,
  initialize3dEngine
} from '../../test-utils'

let engine
let box
let AnchorBehavior
let AnimateBehavior
let DetailBehavior
let DrawBehavior
let FlipBehavior
let LockBehavior
let MoveBehavior
let QuantityBehavior
let RotateBehavior
let StackBehavior
let TargetBehavior

beforeAll(async () => {
  engine = initialize3dEngine().engine
  // use dynamic import to break the cyclic dependency
  ;({
    AnchorBehavior,
    AnimateBehavior,
    DetailBehavior,
    DrawBehavior,
    FlipBehavior,
    LockBehavior,
    MoveBehavior,
    QuantityBehavior,
    RotateBehavior,
    StackBehavior,
    TargetBehavior
  } = await import('../../../src/3d/behaviors'))
})

beforeEach(() => {
  box = CreateBox('box', {})
})

afterAll(() => engine.dispose())

afterEach(() => disposeAllMeshes(box.getScene()))

describe('getAnimatableBehavior() 3D utility', () => {
  it('finds rotable', () => {
    const rotable = new RotateBehavior()
    box.addBehavior(rotable, true)
    expect(getAnimatableBehavior(box)).toEqual(rotable)
  })

  it('finds flippable', () => {
    const flippable = new FlipBehavior()
    box.addBehavior(flippable, true)
    expect(getAnimatableBehavior(box)).toEqual(flippable)
  })

  it('finds animatable', () => {
    const animatable = new AnimateBehavior()
    box.addBehavior(animatable, true)
    expect(getAnimatableBehavior(box)).toEqual(animatable)
  })

  it('finds drawable', () => {
    const drawable = new DrawBehavior()
    box.addBehavior(drawable, true)
    expect(getAnimatableBehavior(box)).toEqual(drawable)
  })

  it('finds movable over others', () => {
    const flippable = new FlipBehavior()
    box.addBehavior(flippable, true)
    const animatable = new AnimateBehavior()
    box.addBehavior(animatable, true)
    const movable = new MoveBehavior()
    box.addBehavior(movable, true)
    const rotable = new RotateBehavior()
    box.addBehavior(rotable, true)
    const drawable = new DrawBehavior()
    box.addBehavior(drawable, true)
    expect(getAnimatableBehavior(box)).toEqual(movable)
  })

  it('finds flippable over others', () => {
    const flippable = new FlipBehavior()
    box.addBehavior(flippable, true)
    const animatable = new AnimateBehavior()
    box.addBehavior(animatable, true)
    const rotable = new RotateBehavior()
    box.addBehavior(rotable, true)
    const drawable = new DrawBehavior()
    box.addBehavior(drawable, true)
    expect(getAnimatableBehavior(box)).toEqual(flippable)
  })

  it('finds drawable over others', () => {
    const drawable = new DrawBehavior()
    box.addBehavior(drawable, true)
    const rotable = new RotateBehavior()
    box.addBehavior(rotable, true)
    const animatable = new AnimateBehavior()
    box.addBehavior(animatable, true)
    expect(getAnimatableBehavior(box)).toEqual(drawable)
  })

  it('finds rotable over others', () => {
    const rotable = new RotateBehavior()
    box.addBehavior(rotable, true)
    const animatable = new AnimateBehavior()
    box.addBehavior(animatable, true)
    expect(getAnimatableBehavior(box)).toEqual(rotable)
  })

  it('can returns nothing', () => {
    expect(getAnimatableBehavior(box)).toBeNull()
  })
})

describe('getTargetableBehavior() 3D utility', () => {
  it('finds anchorable', () => {
    const anchorable = new AnchorBehavior()
    box.addBehavior(anchorable, true)
    expect(getTargetableBehavior(box)).toEqual(anchorable)
  })

  it('finds stackable', () => {
    const stackable = new StackBehavior()
    box.addBehavior(stackable, true)
    expect(getTargetableBehavior(box)).toEqual(stackable)
  })

  it('finds targetable', () => {
    const targetable = new TargetBehavior()
    box.addBehavior(targetable, true)
    expect(getTargetableBehavior(box)).toEqual(targetable)
  })

  it('finds quantifiable', () => {
    const quantifiable = new QuantityBehavior()
    box.addBehavior(quantifiable, true)
    expect(getTargetableBehavior(box)).toEqual(quantifiable)
  })

  it('finds stackable over others', () => {
    const anchorable = new AnchorBehavior()
    box.addBehavior(anchorable, true)
    const stackable = new StackBehavior()
    box.addBehavior(stackable, true)
    const targetable = new TargetBehavior()
    box.addBehavior(targetable, true)
    expect(getTargetableBehavior(box)).toEqual(stackable)
  })

  it('finds anchorable over quantifiable', () => {
    const quantifiable = new QuantityBehavior()
    box.addBehavior(quantifiable, true)
    const anchorable = new AnchorBehavior()
    box.addBehavior(anchorable, true)
    expect(getTargetableBehavior(box)).toEqual(anchorable)
  })

  it('finds quantifiable over targetable', () => {
    const quantifiable = new QuantityBehavior()
    box.addBehavior(quantifiable, true)
    const targetable = new TargetBehavior()
    box.addBehavior(targetable, true)
    expect(getTargetableBehavior(box)).toEqual(quantifiable)
  })

  it('can returns nothing', () => {
    expect(getTargetableBehavior(box)).toBeNull()
  })
})

describe('animateMove() 3D utility', () => {
  it('moves an animatable mesh without gravity', async () => {
    const position = [10, 5, 4]
    box.addBehavior(new AnimateBehavior(), true)
    await animateMove(box, Vector3.FromArray(position), 100)
    expectPosition(box, position)
  })

  it('moves without animation when omitting duration', async () => {
    const position = [-2, -4, -0.5]
    box.addBehavior(new FlipBehavior(), true)
    animateMove(box, Vector3.FromArray(position), 0)
    expectPosition(box, position)
  })

  it('moves without animation regular mesh', async () => {
    const position = [15, 0, -4]
    animateMove(box, Vector3.FromArray(position), 100)
    expectPosition(box, position)
  })

  it('moves an animatable mesh without gravity', async () => {
    const position = [10, 0.5, 4]
    box.addBehavior(new RotateBehavior(), true)
    await animateMove(box, Vector3.FromArray(position), 100, true)
    expectPosition(box, position)
  })

  it('moves without animation regular mesh with gravity', async () => {
    const position = [10, 0.5, -4]
    animateMove(box, Vector3.FromArray(position), 100, true)
    expectPosition(box, position)
  })
})

describe('registerBehaviors() 3D utility', () => {
  it('adds movable behavior to a mesh', () => {
    const state = {
      snapDistance: 0.5,
      duration: 345
    }
    registerBehaviors(box, { movable: state })
    expect(box.getBehaviorByName(MoveBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds flippable behavior to a mesh', () => {
    const state = { isFlipped: true, duration: 123 }
    registerBehaviors(box, { flippable: state })
    expect(box.getBehaviorByName(FlipBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds rotable behavior to a mesh', () => {
    const state = { angle: Math.PI * 0.5, duration: 321 }
    registerBehaviors(box, { rotable: state })
    expect(box.getBehaviorByName(RotateBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds detailable behavior to a mesh', () => {
    const state = { frontImage: 'front.png', backImage: 'back.png' }
    registerBehaviors(box, { detailable: state })
    expect(box.getBehaviorByName(DetailBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds anchorable behavior to a mesh', () => {
    const state = {
      anchors: [
        {
          x: 10,
          y: 15,
          z: -5,
          width: 12,
          height: 3.5,
          depth: 1.5,
          kinds: ['card'],
          snappedId: 'a426f1'
        }
      ],
      duration: 415
    }
    registerBehaviors(box, { anchorable: state })
    expect(box.getBehaviorByName(AnchorBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds stackable behavior to a mesh', () => {
    const state = {
      extent: 1.5,
      stackIds: [],
      kinds: ['round-token'],
      duration: 415
    }
    registerBehaviors(box, { stackable: state })
    expect(box.getBehaviorByName(StackBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds drawable behavior to a mesh', () => {
    const state = { duration: 300, unflipOnPick: false, flipOnPlay: true }
    registerBehaviors(box, { drawable: state })
    expect(box.getBehaviorByName(DrawBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds lockable behavior to a mesh', () => {
    const state = { isLocked: true }
    registerBehaviors(box, { lockable: state })
    expect(box.getBehaviorByName(LockBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds multiple behaviors to a mesh', () => {
    registerBehaviors(box, {
      detailable: {},
      movable: {},
      stackable: { extent: 1.5 },
      anchorable: { anchors: [] },
      flippable: { isFlipped: false },
      rotable: { angle: Math.PI },
      lockable: { isLocked: false }
    })
    expect(box.getBehaviorByName(AnchorBehaviorName)).toHaveProperty('state', {
      anchors: [],
      duration: 100
    })
    expect(box.getBehaviorByName(DetailBehaviorName)).toBeDefined()
    expect(box.getBehaviorByName(FlipBehaviorName)).toHaveProperty('state', {
      duration: 500,
      isFlipped: false
    })
    expect(box.getBehaviorByName(MoveBehaviorName)).toBeDefined()
    expect(box.getBehaviorByName(RotateBehaviorName)).toHaveProperty('state', {
      duration: 200,
      angle: Math.PI
    })
    expect(box.getBehaviorByName(StackBehaviorName)).toHaveProperty('state', {
      stackIds: [],
      duration: 100,
      extent: 1.5
    })
    expect(box.getBehaviorByName(LockBehaviorName)).toHaveProperty('state', {
      isLocked: false
    })
    expect(box.behaviors).toHaveLength(7)
  })

  it('adds nothing without parameters', () => {
    registerBehaviors(box, { animatable: true })
    expect(box.behaviors).toHaveLength(0)
  })

  it('adds lockable after all other behavior', () => {
    registerBehaviors(box, { lockable: { isLocked: true }, movable: {} })
    expect(box.getBehaviorByName(LockBehaviorName)).toHaveProperty('state', {
      isLocked: true
    })
    expect(box.getBehaviorByName(MoveBehaviorName)).toHaveProperty(
      'enabled',
      false
    )
  })
})

describe('restoreBehaviors() 3D utility', () => {
  it('restores movable behavior', () => {
    const state = { snapDistance: 0.5, duration: 345 }
    const movable = new MoveBehavior()
    box.addBehavior(movable, true)
    restoreBehaviors(box.behaviors, { movable: state })
    expect(movable.state).toEqual(state)
  })

  it('restores flippable behavior', () => {
    const state = { isFlipped: true, duration: 123 }
    const flippable = new FlipBehavior()
    box.addBehavior(flippable, true)
    restoreBehaviors(box.behaviors, { flippable: state })
    expect(flippable.state).toEqual(state)
  })

  it('restores rotable behavior', () => {
    const state = { angle: Math.PI * -0.5, duration: 432 }
    const rotable = new RotateBehavior()
    box.addBehavior(rotable, true)
    restoreBehaviors(box.behaviors, { rotable: state })
    expect(rotable.state).toEqual(state)
  })

  it('restores detailable behavior', () => {
    const state = { frontImage: 'front.png', backImage: 'back.jpg' }
    const detailable = new DetailBehavior()
    box.addBehavior(detailable, true)
    restoreBehaviors(box.behaviors, { detailable: state })
    expect(detailable.state).toEqual(state)
  })

  it('restores anchorable behavior', () => {
    const state = {
      anchors: [
        {
          x: 10,
          y: 15,
          z: -5,
          width: 12,
          height: 3.5,
          depth: 1.5,
          kinds: ['card'],
          snappedId: 'a426f1'
        }
      ],
      duration: 415
    }
    const anchorable = new AnchorBehavior()
    box.addBehavior(anchorable, true)
    restoreBehaviors(box.behaviors, { anchorable: state })
    expect(anchorable.state).toEqual(state)
  })

  it('restores lockable behavior', () => {
    const state = { isLocked: false }
    const lockable = new LockBehavior()
    box.addBehavior(lockable, true)
    restoreBehaviors(box.behaviors, { lockable: state })
    expect(lockable.state).toEqual(state)
  })

  it('does not restore stackable behavior', () => {
    const state = {
      stackIds: ['a426f1', '23f658'],
      extent: 1.5,
      kinds: ['round-token'],
      duration: 415
    }
    const stackable = new StackBehavior()
    box.addBehavior(stackable, true)
    restoreBehaviors(box.behaviors, { stackable: state })
    expect(stackable.state).toEqual({
      duration: 100,
      extent: 2,
      stackIds: []
    })
  })

  it('restores multiple behaviors', () => {
    const flippable = { isFlipped: true, duration: 123 }
    const anchorable = {
      anchors: [
        {
          x: 10,
          y: 15,
          z: -5,
          width: 12,
          height: 3.5,
          depth: 1.5,
          kinds: ['card'],
          snappedId: 'a426f1'
        }
      ],
      duration: 415
    }
    const rotable = { angle: Math.PI * -0.5, duration: 432 }
    const stackable = {
      stackIds: ['a426f1', '23f658'],
      extent: 1.5,
      kinds: ['round-token'],
      duration: 415
    }
    const movable = {
      snapDistance: 0.5,
      duration: 345
    }
    const lockable = { isLocked: false }
    box.addBehavior(new MoveBehavior(), true)
    box.addBehavior(new FlipBehavior(), true)
    box.addBehavior(new RotateBehavior(), true)
    box.addBehavior(new DetailBehavior(), true)
    box.addBehavior(new AnchorBehavior(), true)
    box.addBehavior(new StackBehavior(), true)
    box.addBehavior(new AnimateBehavior(), true)
    box.addBehavior(new LockBehavior(), true)
    restoreBehaviors(box.behaviors, {
      detailable: true,
      movable,
      flippable,
      anchorable,
      rotable,
      stackable,
      lockable
    })
    expect(box.getBehaviorByName(MoveBehaviorName).state).toEqual(movable)
    expect(box.getBehaviorByName(FlipBehaviorName).state).toEqual(flippable)
    expect(box.getBehaviorByName(RotateBehaviorName).state).toEqual(rotable)
    expect(box.getBehaviorByName(AnchorBehaviorName).state).toEqual(anchorable)
    expect(box.getBehaviorByName(StackBehaviorName).state).toEqual({
      duration: 100,
      extent: 2,
      stackIds: []
    })
    expect(box.getBehaviorByName(LockBehaviorName).state).toEqual(lockable)
  })

  it('does nothing without parameters', () => {
    box.addBehavior(new MoveBehavior(), true)
    box.addBehavior(new FlipBehavior(), true)
    box.addBehavior(new RotateBehavior(), true)
    box.addBehavior(new DetailBehavior(), true)
    box.addBehavior(new AnchorBehavior(), true)
    box.addBehavior(new StackBehavior(), true)
    box.addBehavior(new AnimateBehavior(), true)
    box.addBehavior(new LockBehavior(), true)
    restoreBehaviors(box.behaviors, {})
    expect(box.getBehaviorByName(MoveBehaviorName).state).toEqual({
      snapDistance: 0.25,
      duration: 100
    })
    expect(box.getBehaviorByName(FlipBehaviorName).state).toEqual({
      isFlipped: false,
      duration: 500
    })
    expect(box.getBehaviorByName(RotateBehaviorName).state).toEqual({
      angle: 0,
      duration: 200
    })
    expect(box.getBehaviorByName(AnchorBehaviorName).state).toEqual({
      anchors: [],
      duration: 100
    })
    expect(box.getBehaviorByName(StackBehaviorName).state).toEqual({
      duration: 100,
      extent: 2,
      stackIds: []
    })
    expect(box.getBehaviorByName(LockBehaviorName).state).toEqual({
      isLocked: false
    })
  })
})

describe('serializeBehaviors() 3D utility', () => {
  it('serializes movable behavior', () => {
    const state = { snapDistance: 0.5, duration: 345 }
    expect(serializeBehaviors([new MoveBehavior(state)])).toEqual({
      movable: state
    })
  })

  it('serializes flippable behavior', () => {
    const state = { isFlipped: true, duration: 123 }
    expect(serializeBehaviors([new FlipBehavior(state)])).toEqual({
      flippable: state
    })
  })

  it('serializes rotable behavior', () => {
    const state = { angle: Math.PI, duration: 432 }
    const mesh = CreateBox('box1')
    const rotable = new RotateBehavior(state)
    mesh.addBehavior(rotable, true)
    expect(serializeBehaviors([rotable])).toEqual({
      rotable: state
    })
  })

  it('serializes stackable behavior', () => {
    const state = {
      stackIds: ['a426f1', '23f658'],
      extent: 1.5,
      kinds: ['round-token'],
      duration: 415
    }
    expect(serializeBehaviors([new StackBehavior(state)])).toEqual({
      stackable: { ...state, stackIds: [] }
    })
  })

  it('serializes anchorable behavior', () => {
    const state = {
      anchors: [
        {
          x: 10,
          y: 15,
          z: -5,
          width: 12,
          height: 3.5,
          depth: 1.5,
          kinds: ['card'],
          snappedId: 'a426f1'
        }
      ],
      duration: 415
    }
    expect(serializeBehaviors([new AnchorBehavior(state)])).toEqual({
      anchorable: state
    })
  })

  it('serializes detailable behavior', () => {
    const state = { frontImage: 'front.png', backImage: 'back.jpg' }
    expect(serializeBehaviors([new DetailBehavior(state)])).toEqual({
      detailable: state
    })
  })

  it('serializes drawable behavior', () => {
    const state = { duration: 415 }
    expect(serializeBehaviors([new DrawBehavior(state)])).toEqual({
      drawable: state
    })
  })

  it('serializes lockable behavior', () => {
    const state = { isLocked: true }
    expect(serializeBehaviors([new LockBehavior(state)])).toEqual({
      lockable: state
    })
  })

  it('serializes multiple behaviors', () => {
    const flippable = { isFlipped: true, duration: 123 }
    const anchorable = {
      anchors: [
        {
          x: 10,
          y: 15,
          z: -5,
          width: 12,
          height: 3.5,
          depth: 1.5,
          kinds: ['card'],
          snappedId: 'a426f1'
        }
      ],
      duration: 415
    }
    const rotable = { angle: Math.PI, duration: 432 }
    const stackable = {
      stackIds: ['a426f1', '23f658'],
      extent: 1.5,
      kinds: ['round-token'],
      duration: 415
    }
    const movable = {
      snapDistance: 0.5,
      duration: 345
    }
    const detailable = { frontImage: 'front.png', backImage: 'back.jpg' }
    const lockable = { isLocked: false }
    box.addBehavior(new MoveBehavior(movable), true)
    box.addBehavior(new FlipBehavior(flippable), true)
    box.addBehavior(new RotateBehavior(rotable), true)
    box.addBehavior(new DetailBehavior(detailable), true)
    box.addBehavior(new AnchorBehavior(anchorable), true)
    box.addBehavior(new StackBehavior(stackable), true)
    box.addBehavior(new AnimateBehavior(), true)
    box.addBehavior(new LockBehavior(lockable), true)
    expect(serializeBehaviors(box.behaviors)).toEqual({
      flippable,
      anchorable,
      stackable: { ...stackable, stackIds: [] },
      rotable,
      movable,
      detailable,
      lockable
    })
  })

  it('does nothing without behaviors', () => {
    expect(serializeBehaviors([])).toEqual({})
  })
})

describe('runAnimation() 3D utility', () => {
  let behavior

  beforeEach(() => {
    behavior = new AnimateBehavior()
    box.addBehavior(behavior, true)
  })

  it('handles Float animated properties', async () => {
    const duration = 100
    const animation = new Animation(
      'fade',
      'visibility',
      behavior.frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
    await runAnimation(behavior, null, {
      animation,
      duration,
      keys: [
        { frame: 0, values: [1, undefined, 1] },
        { frame: 50, values: [1, null, null, 3] },
        { frame: 100, values: [0, 2] }
      ]
    })
    expect(animation.getKeys()).toEqual([
      { frame: 0, value: 1, outTangent: 1 },
      {
        frame: 3,
        value: 1,
        inTangent: null,
        outTangent: null,
        interpolation: 3
      },
      { frame: 6, value: 0, inTangent: 2 }
    ])
  })

  it('handles Vector3 animated properties', async () => {
    const duration = 100
    const animation = new Animation(
      'rotate',
      'rotation',
      behavior.frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
    await runAnimation(behavior, null, {
      animation,
      duration,
      keys: [
        { frame: 0, values: [1, 2, 3, undefined, [1, 1, 1]] },
        { frame: 50, values: [2, 3, 4, null, null, [3, 3, 3]] },
        { frame: 100, values: [3, 4, 5, [2, 2, 2]] }
      ]
    })
    const finalRotation = new Vector3(3, 4, 5)
    finalRotation._isDirty = false
    expect(animation.getKeys()).toEqual([
      {
        frame: 0,
        value: new Vector3(1, 2, 3),
        outTangent: new Vector3(1, 1, 1)
      },
      {
        frame: 3,
        value: new Vector3(2, 3, 4),
        interpolation: new Vector3(3, 3, 3)
      },
      { frame: 6, value: finalRotation, inTangent: new Vector3(2, 2, 2) }
    ])
  })

  it('picks longest animations', async () => {
    const duration = Math.floor(500 * Math.random() + 300)
    const animation = new Animation(
      'fade',
      'visibility',
      behavior.frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
    expect(box.visibility).toEqual(1)
    const start = Date.now()
    await runAnimation(
      behavior,
      null,
      {
        animation,
        duration,
        keys: [
          { frame: 0, values: [1] },
          { frame: 100, values: [0] }
        ]
      },
      {
        animation: behavior.moveAnimation,
        duration: duration * 0.5,
        keys: [
          { frame: 0, values: [0, 0, 0] },
          { frame: 100, values: [10, 10, 10] }
        ]
      }
    )
    const ellapsed = Date.now() - start
    expect(ellapsed).toBeGreaterThanOrEqual(duration * 0.75)
    expect(ellapsed).toBeLessThanOrEqual(duration * 1.25)
    expect(box.visibility).toEqual(0)
    expectPosition(box, [10, 10, 10])
  })
})

describe('isMeshFlipped()', () => {
  it('returns false for regular mesh', () => {
    expect(isMeshFlipped(box)).toBe(false)
    box.rotation.z = Math.PI
    box.computeWorldMatrix(true)
    expect(isMeshFlipped(box)).toBe(false)
  })

  it('returns false for un-flipped mesh', () => {
    box.addBehavior(new FlipBehavior(), true)
    expect(isMeshFlipped(box)).toBe(false)
  })

  it('returns true for flipped mesh', async () => {
    box.addBehavior(new FlipBehavior({ isFlipped: true, duration: 50 }), true)
    expect(isMeshFlipped(box)).toBe(true)
    await box.metadata.flip()
    expect(isMeshFlipped(box)).toBe(false)
    await box.metadata.flip()
    expect(isMeshFlipped(box)).toBe(true)
  })
})

describe('isMeshInverted()', () => {
  it('returns false for regular mesh', () => {
    expect(isMeshInverted(box)).toBe(false)
    box.rotation.y = Math.PI
    box.computeWorldMatrix(true)
    expect(isMeshInverted(box)).toBe(false)
  })

  it('returns true for inverted mesh', async () => {
    box.addBehavior(new RotateBehavior({ angle: Math.PI, duration: 50 }), true)
    expect(isMeshInverted(box)).toBe(true)
    await box.metadata.rotate()
    expect(isMeshInverted(box)).toBe(false)
    await box.metadata.rotate()
    expect(isMeshInverted(box)).toBe(false)
    await box.metadata.rotate()
    expect(isMeshInverted(box)).toBe(false)
    await box.metadata.rotate()
    expect(isMeshInverted(box)).toBe(true)
  })

  it('returns true for inverted child mesh', async () => {
    const parent = CreateBox('parent')
    parent.addBehavior(
      new RotateBehavior({ angle: Math.PI, duration: 50 }),
      true
    )
    box.addBehavior(new RotateBehavior({ duration: 50 }), true)
    box.parent = parent
    expect(isMeshInverted(parent)).toBe(true)
    expect(isMeshInverted(box)).toBe(true)
  })
})

describe('given a test behavior', () => {
  let behavior

  beforeEach(() => {
    behavior = new TestBehavior()
    box.addBehavior(behavior, true)
    box.metadata = {}
  })

  describe('attachProperty()', () => {
    it('creates metadata', () => {
      delete box.metadata
      const getter = vi.fn().mockReturnValue('test')
      attachProperty(behavior, 'testProp', getter)
      expect(box.metadata.testProp).toEqual('test')
      expect(getter).toHaveBeenCalledTimes(1)
    })

    it('creates a getter', () => {
      const value = Math.random()
      const getter = vi.fn().mockReturnValue(value)
      attachProperty(behavior, 'testProp', getter)
      expect(box.metadata.testProp).toEqual(value)
      expect(getter).toHaveBeenCalledTimes(1)
    })

    it('creates rewritable and enumeratable getters', () => {
      const value = Math.random()
      const getter = vi.fn().mockReturnValue(value)
      attachProperty(behavior, 'testProp2', getter)
      expect(JSON.stringify(box.metadata)).toEqual(
        JSON.stringify({ testProp2: value })
      )
      attachProperty(behavior, 'testProp2', () => null)
      expect(box.metadata.testProp2).toBeNull()
      expect(getter).toHaveBeenCalledTimes(1)
    })
  })

  describe('attachFunctions()', () => {
    it('creates metadata', () => {
      delete box.metadata
      attachFunctions(behavior, 'foo')
      expect(box.metadata.foo).toBeInstanceOf(Function)
    })

    it('attaches a single function', () => {
      attachFunctions(behavior, 'foo')
      expect(box.metadata.foo).toBeInstanceOf(Function)
      expect(box.metadata.foo()).toEqual('foo')
    })

    it('attaches a multiple functions', () => {
      attachFunctions(behavior, 'bar', 'foo')
      expect(box.metadata.foo).toBeInstanceOf(Function)
      expect(box.metadata.bar).toBeInstanceOf(Function)
      expect(box.metadata.foo()).toEqual('foo')
      expect(box.metadata.bar()).toEqual('bar')
    })
  })
})

class TestBehavior {
  constructor() {
    this.mesh = null
    this._foo = 'foo'
  }

  init() {}

  attach(mesh) {
    this.mesh = mesh
  }

  detach() {
    this.mesh = null
  }

  foo() {
    return this._foo
  }

  bar() {
    return 'bar'
  }
}
