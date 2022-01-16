import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import {
  AnchorBehaviorName,
  DetailBehaviorName,
  FlipBehaviorName,
  MoveBehaviorName,
  RotateBehaviorName,
  StackBehaviorName
} from '../../../src/3d/behaviors/names'
import {
  animateMove,
  getAnimatableBehavior,
  getTargetableBehavior,
  registerBehaviors,
  restoreBehaviors,
  serializeBehaviors
} from '../../../src/3d/utils/behaviors'
import { initialize3dEngine } from '../../test-utils'

let engine
let box
let AnchorBehavior
let AnimateBehavior
let DetailBehavior
let FlipBehavior
let MoveBehavior
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
    FlipBehavior,
    MoveBehavior,
    RotateBehavior,
    StackBehavior,
    TargetBehavior
  } = await import('../../../src/3d/behaviors'))
})

beforeEach(() => {
  box = CreateBox('box', {})
})

afterAll(() => engine.dispose())

afterEach(() => {
  box.dispose()
})

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

  it('finds animatable over others', () => {
    const flippable = new FlipBehavior()
    box.addBehavior(flippable, true)
    const animatable = new AnimateBehavior()
    box.addBehavior(animatable, true)
    const rotable = new RotateBehavior()
    box.addBehavior(rotable, true)
    expect(getAnimatableBehavior(box)).toEqual(animatable)
  })

  it('finds flippable over rotable', () => {
    const rotable = new RotateBehavior()
    box.addBehavior(rotable, true)
    const flippable = new FlipBehavior()
    box.addBehavior(flippable, true)
    expect(getAnimatableBehavior(box)).toEqual(flippable)
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

  it('finds stackable over others', () => {
    const anchorable = new AnchorBehavior()
    box.addBehavior(anchorable, true)
    const stackable = new StackBehavior()
    box.addBehavior(stackable, true)
    const targetable = new TargetBehavior()
    box.addBehavior(targetable, true)
    expect(getTargetableBehavior(box)).toEqual(stackable)
  })

  it('finds anchorable over rotable', () => {
    const anchorable = new AnchorBehavior()
    box.addBehavior(anchorable, true)
    const targetable = new TargetBehavior()
    box.addBehavior(targetable, true)
    expect(getTargetableBehavior(box)).toEqual(anchorable)
  })

  it('can returns nothing', () => {
    expect(getTargetableBehavior(box)).toBeNull()
  })
})

describe('animateMove() 3D utility', () => {
  it('moves an animatable mesh without gravity', async () => {
    const position = new Vector3(10, 5, 4)
    box.addBehavior(new AnimateBehavior(), true)
    await animateMove(box, position, 100)
    expect(box.absolutePosition).toEqual(position)
  })

  it('moves without animation when omitting duration', async () => {
    const position = new Vector3(-2, -4, -0.5)
    box.addBehavior(new FlipBehavior(), true)
    animateMove(box, position, 0)
    expect(box.absolutePosition).toEqual(position)
  })

  it('moves without animation regular mesh', async () => {
    const position = new Vector3(15, 0, -4)
    animateMove(box, position, 100)
    expect(box.absolutePosition).toEqual(position)
  })

  it('moves an animatable mesh without gravity', async () => {
    box.addBehavior(new RotateBehavior(), true)
    await animateMove(box, new Vector3(10, 5, 4), 100, true)
    expect(box.absolutePosition).toEqual(new Vector3(10, 0.25, 4))
  })

  it('moves without animation regular mesh with gravity', async () => {
    animateMove(box, new Vector3(15, 0, -4), 100, true)
    expect(box.absolutePosition).toEqual(new Vector3(15, 0.25, -4))
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
    const state = { angle: Math.PI * 0.75, duration: 321 }
    registerBehaviors(box, { rotable: state })
    expect(box.getBehaviorByName(RotateBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds detailable behavior to a mesh', () => {
    const state = true
    registerBehaviors(box, { detailable: state })
    expect(box.getBehaviorByName(DetailBehaviorName)).toBeDefined()
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
      stack: [],
      isCylindric: true,
      kinds: ['round-token'],
      duration: 415
    }
    registerBehaviors(box, { stackable: state })
    expect(box.getBehaviorByName(StackBehaviorName)).toHaveProperty(
      'state',
      state
    )
  })

  it('adds multiple behaviors to a mesh', () => {
    registerBehaviors(box, {
      detailable: true,
      movable: true,
      stackable: { extent: 1.5 },
      anchorable: { anchors: [] },
      flippable: { isFlipped: false },
      rotable: { angle: Math.PI }
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
      stack: [],
      duration: 100,
      extent: 1.5
    })
    expect(box.behaviors).toHaveLength(6)
  })

  it('adds nothing without parameters', () => {
    registerBehaviors(box, { animatable: true })
    expect(box.behaviors).toHaveLength(0)
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
    const state = { angle: Math.PI * 0.75, duration: 432 }
    const rotable = new RotateBehavior()
    box.addBehavior(rotable, true)
    restoreBehaviors(box.behaviors, { rotable: state })
    expect(rotable.state).toEqual(state)
  })

  it('restores detailable behavior', () => {
    const detailable = new DetailBehavior()
    box.addBehavior(detailable, true)
    restoreBehaviors(box.behaviors, { detailable: true })
    expect(detailable).toEqual(detailable)
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

  it('does not restore stackable behavior', () => {
    const state = {
      stack: ['a426f1', '23f658'],
      extent: 1.5,
      isCylindric: true,
      kinds: ['round-token'],
      duration: 415
    }
    const stackable = new StackBehavior()
    box.addBehavior(stackable, true)
    restoreBehaviors(box.behaviors, { stackable: state })
    expect(stackable.state).toEqual({
      duration: 100,
      extent: 0.3,
      stack: []
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
    const rotable = { angle: Math.PI * 0.75, duration: 432 }
    const stackable = {
      stack: ['a426f1', '23f658'],
      extent: 1.5,
      isCylindric: true,
      kinds: ['round-token'],
      duration: 415
    }
    const movable = {
      snapDistance: 0.5,
      duration: 345
    }
    box.addBehavior(new MoveBehavior(), true)
    box.addBehavior(new FlipBehavior(), true)
    box.addBehavior(new RotateBehavior(), true)
    box.addBehavior(new DetailBehavior(), true)
    box.addBehavior(new AnchorBehavior(), true)
    box.addBehavior(new StackBehavior(), true)
    box.addBehavior(new AnimateBehavior(), true)
    restoreBehaviors(box.behaviors, {
      detailable: true,
      movable,
      flippable,
      anchorable,
      rotable,
      stackable
    })
    expect(box.getBehaviorByName(MoveBehaviorName).state).toEqual(movable)
    expect(box.getBehaviorByName(FlipBehaviorName).state).toEqual(flippable)
    expect(box.getBehaviorByName(RotateBehaviorName).state).toEqual(rotable)
    expect(box.getBehaviorByName(AnchorBehaviorName).state).toEqual(anchorable)
    expect(box.getBehaviorByName(StackBehaviorName).state).toEqual({
      duration: 100,
      extent: 0.3,
      stack: []
    })
  })

  it('does nothing without parameters', () => {
    box.addBehavior(new MoveBehavior(), true)
    box.addBehavior(new FlipBehavior(), true)
    box.addBehavior(new RotateBehavior(), true)
    box.addBehavior(new DetailBehavior(), true)
    box.addBehavior(new AnchorBehavior(), true)
    box.addBehavior(new StackBehavior(), true)
    box.addBehavior(new AnimateBehavior(), true)
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
      duration: 100
    })
    expect(box.getBehaviorByName(StackBehaviorName).state).toEqual({
      duration: 100,
      extent: 0.3,
      stack: []
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
    const state = { angle: Math.PI * 0.75, duration: 432 }
    expect(serializeBehaviors([new RotateBehavior(state)])).toEqual({
      rotable: state
    })
  })

  it('serializes stackable behavior', () => {
    const state = {
      stack: ['a426f1', '23f658'],
      extent: 1.5,
      isCylindric: true,
      kinds: ['round-token'],
      duration: 415
    }
    expect(serializeBehaviors([new StackBehavior(state)])).toEqual({
      stackable: { ...state, stack: [] }
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

  it('does not serialize detailable behavior', () => {
    expect(serializeBehaviors([new DetailBehavior()])).toEqual({
      detailable: true
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
    const rotable = { angle: Math.PI * 0.75, duration: 432 }
    const stackable = {
      stack: ['a426f1', '23f658'],
      extent: 1.5,
      isCylindric: true,
      kinds: ['round-token'],
      duration: 415
    }
    const movable = {
      snapDistance: 0.5,
      duration: 345
    }
    box.addBehavior(new MoveBehavior(movable), true)
    box.addBehavior(new FlipBehavior(flippable), true)
    box.addBehavior(new RotateBehavior(rotable), true)
    box.addBehavior(new DetailBehavior(), true)
    box.addBehavior(new AnchorBehavior(anchorable), true)
    box.addBehavior(new StackBehavior(stackable), true)
    box.addBehavior(new AnimateBehavior(), true)
    expect(serializeBehaviors(box.behaviors)).toEqual({
      flippable,
      anchorable,
      stackable: { ...stackable, stack: [] },
      rotable,
      movable,
      detailable: true
    })
  })

  it('does nothing without behaviors', () => {
    expect(serializeBehaviors([])).toEqual({})
  })
})
