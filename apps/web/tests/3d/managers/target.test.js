// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import { MoveBehavior, TargetBehavior } from '@src/3d/behaviors'
import { TargetManager } from '@src/3d/managers'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine, createBox } from '../../test-utils'

describe('TargetManager', () => {
  let drops
  /** @type {import('@babylonjs/core').Scene} */
  let scene
  /** @type {import('@babylonjs/core').Scene} */
  let handScene
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {string} */
  let playerId
  /** @type {string} */
  let color

  configures3dTestEngine(
    created => {
      scene = created.scene
      handScene = created.handScene
      managers = created.managers
      playerId = created.playerId
      color = managers.target.color.toHexString()
    },
    { isSimulation: globalThis.use3dSimulation }
  )

  beforeEach(() => {
    vi.clearAllMocks()
    drops = []
  })

  describe('init()', () => {
    it('sets scene', () => {
      const playerId = faker.string.uuid()
      const color = faker.color.rgb()
      const manager = new TargetManager({ scene })
      manager.init({ managers, playerId, color })
      expect(manager.playerId).toEqual(playerId)
    })
  })

  describe('registerTargetable()', () => {
    it('registers a mesh', () => {
      const mesh = createBox('box3', {})
      mesh.addBehavior(new TargetBehavior({}, managers), true)
      expect(managers.target.isManaging(mesh)).toBe(true)
    })

    it('automatically unregisters a mesh upon disposal', () => {
      const mesh = createBox('box3', {})
      mesh.addBehavior(new TargetBehavior({}, managers), true)
      expect(managers.target.isManaging(mesh)).toBe(true)

      mesh.dispose()
      expect(managers.target.isManaging(mesh)).toBe(false)
    })

    it('automatically unregisters a mesh upon behavior detachment', () => {
      const mesh = createBox('box3', {})
      const behavior = new TargetBehavior({}, managers)
      mesh.addBehavior(behavior, true)
      expect(managers.target.isManaging(mesh)).toBe(true)

      behavior.detach()
      expect(managers.target.isManaging(mesh)).toBe(false)
    })

    it('handles invalid behavior', () => {
      const behavior = new TargetBehavior({}, managers)
      managers.target.registerTargetable(behavior)
      // @ts-expect-error: we don't provide a behavior
      managers.target.registerTargetable()
    })
  })

  describe('unregisterTargetable()', () => {
    it('handles invalid behavior', () => {
      const behavior = new TargetBehavior({}, managers)
      managers.target.unregisterTargetable(behavior)
      // @ts-expect-error: we don't provide a behavior
      managers.target.unregisterTargetable()
    })
  })

  describe('findDropZone()', () => {
    /** @type {import('@src/3d/managers').SingleDropZone} */
    let zone1
    /** @type {import('@src/3d/managers').SingleDropZone} */
    let zone2
    const aboveZone1 = new Vector3(5, 1, 5)
    const partiallyAboveZone1 = new Vector3(5.5, 2, 5)
    const aboveZone2 = new Vector3(-5, 1, -5)
    const aboveZone3 = new Vector3(10, 1, 10)

    beforeEach(() => {
      zone1 = createsTargetZone('target1', {
        position: new Vector3(aboveZone1.x, 0, aboveZone1.z)
      })
      zone2 = createsTargetZone('target2', {
        position: new Vector3(aboveZone2.x, 0, aboveZone2.z)
      })
    })

    it('returns nothing if mesh is not above any target', () => {
      expect(managers.target.findDropZone(createBox('box', {}))).toBeNull()
    })

    it('returns targets below mesh', () => {
      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(aboveZone1)

      expectActiveZone(managers.target.findDropZone(mesh), zone1, color)
    })

    it('ignores an overlaping target when mesh is too far from center', () => {
      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(aboveZone1.add(new Vector3(1, 0, 0)))

      expect(managers.target.findDropZone(mesh)).toBeNull()
    })

    it('ignores targets with kinds below kind-less mesh', () => {
      zone1.kinds = ['card']
      const mesh = createBox('box2', {})
      mesh.setAbsolutePosition(aboveZone1)

      expect(managers.target.findDropZone(mesh)).toBeNull()
    })

    it('ignores disabled targets', () => {
      zone1.enabled = false
      const mesh = createBox('box2', {})
      mesh.setAbsolutePosition(aboveZone1)

      expect(managers.target.findDropZone(mesh)).toBeNull()
    })

    it('ignores target part of the current selection', () => {
      managers.selection.select(
        /** @type {import('@babylonjs/core').Mesh} */ (zone1.targetable.mesh)
      )
      const mesh = createBox('box2', {})
      mesh.setAbsolutePosition(zone1.mesh.absolutePosition)

      expect(managers.target.findDropZone(mesh)).toBeNull()
    })

    it('ignores targets from different scene', () => {
      const handMesh = createBox('box', {}, handScene)
      handMesh.setAbsolutePosition(aboveZone2)
      expect(managers.target.findDropZone(handMesh)).toBeNull()

      createsTargetZone('target3', {
        position: new Vector3(10, 0, 10),
        scene: handScene
      })
      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(aboveZone3)
      expect(managers.target.findDropZone(mesh)).toBeNull()
    })

    it('ignores targets with another player Id', () => {
      createsTargetZone('target3', {
        position: new Vector3(10, 0, 10),
        playerId: faker.string.uuid(),
        scene
      })
      const mesh = createBox('box', {}, scene)
      mesh.setAbsolutePosition(aboveZone3)

      expect(managers.target.findDropZone(mesh)).toBeNull()
    })

    it('ignores partially overlapped multiple anchor', () => {
      zone1.snappedIds = ['box1']
      zone1.max = 2
      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(partiallyAboveZone1)

      expect(managers.target.findDropZone(mesh)).toBeNull()
    })

    it('returns targets with same playerId below mesh with kind', () => {
      const zone3 = createsTargetZone('target3', {
        position: new Vector3(10, 0, 10),
        playerId,
        scene
      })
      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(aboveZone3)

      expectActiveZone(managers.target.findDropZone(mesh, 'box'), zone3, color)
    })

    it('returns kind-less targets below mesh with kind', () => {
      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(aboveZone1)

      expectActiveZone(managers.target.findDropZone(mesh, 'box'), zone1, color)
    })

    it('returns anchor partially below mesh', () => {
      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(partiallyAboveZone1)

      expectActiveZone(managers.target.findDropZone(mesh, 'box'), zone1, color)
    })

    it('returns targets below mesh with matching kind', () => {
      zone1.kinds = ['card', 'box']
      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(aboveZone2)

      expectActiveZone(managers.target.findDropZone(mesh, 'box'), zone2, color)
    })

    it('returns closest target below mesh regardless of elevation and priorities', () => {
      createsTargetZone('target3', {
        position: new Vector3(0.5, 0, 0),
        priority: 10
      })
      createsTargetZone('target4', { position: new Vector3(-0.5, 1, 0) })
      const zone5 = createsTargetZone('target5', {
        position: Vector3.Zero()
      })

      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(new Vector3(0, 5, 0))

      expectActiveZone(managers.target.findDropZone(mesh, 'box'), zone5, color)
    })

    it('returns highest target below mesh regardless of priorities', () => {
      createsTargetZone('target3', {
        position: Vector3.Zero(),
        priority: 10
      })
      const zone4 = createsTargetZone('target4', {
        position: new Vector3(0, 1, 0)
      })
      createsTargetZone('target5', { position: new Vector3(0, 0.5, 0) })

      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(new Vector3(0, 5, 0))

      expectActiveZone(managers.target.findDropZone(mesh, 'box'), zone4, color)
    })

    it('returns highest priority target below mesh', () => {
      createsTargetZone('target3', Vector3.Zero())
      const zone4 = createsTargetZone('target4', {
        position: Vector3.Zero(),
        priority: 2
      })
      createsTargetZone('target5', {
        position: Vector3.Zero(),
        priority: 1
      })

      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(new Vector3(0, 5, 0))

      expectActiveZone(managers.target.findDropZone(mesh, 'box'), zone4, color)
    })

    it('returns overlapped multiple anchor', () => {
      zone1.snappedIds = ['box1']
      zone1.max = 2
      const mesh = createBox('box', {})
      mesh.setAbsolutePosition(aboveZone1)

      expectActiveZone(managers.target.findDropZone(mesh), zone1, color)
    })

    describe('given a mesh with parts', () => {
      /** @type {import('@babylonjs/core').Mesh} */
      let mesh

      beforeEach(() => {
        mesh = createBox('multi-box', { width: 2 })
        mesh.addBehavior(
          new MoveBehavior({ partCenters: [{ x: 0.5 }, { x: 1.5 }] }, managers),
          true
        )
        mesh.setAbsolutePosition(new Vector3(0, 1, 0))
      })

      it('returns a multi drop zone', () => {
        const zone4 = createsTargetZone('target4', {
          position: Vector3.Zero()
        })
        const zone5 = createsTargetZone('target5', {
          position: new Vector3(1, 0, 0)
        })

        expect(managers.target.findDropZone(mesh, 'box')).toEqual({
          parts: [zone4, zone5],
          mesh: zone4.mesh,
          targetable: zone4.targetable
        })
      })

      it('gives precedence to a single drop zone that ignore part', () => {
        createsTargetZone('target4', { position: Vector3.Zero() })
        createsTargetZone('target5', { position: new Vector3(1, 0, 0) })
        const zone6 = createsTargetZone('target6', {
          position: new Vector3(0.5, 0, 0),
          ignoreParts: true
        })

        expect(managers.target.findDropZone(mesh, 'box')).toEqual(zone6)
      })

      it('returns null when at least one part is not covered', () => {
        createsTargetZone('target4', { position: Vector3.Zero() })
        createsTargetZone('target5', { position: new Vector3(-1, 0, 0) })

        expect(managers.target.findDropZone(mesh, 'box')).toBeNull()
      })

      it('clears an active multi zone', () => {
        createsTargetZone('target4', { position: Vector3.Zero() })
        createsTargetZone('target5', { position: new Vector3(1, 0, 0) })

        const multiZone = managers.target.findDropZone(mesh, 'box')
        expectVisibility(multiZone, true)
        managers.target.clear(multiZone)
        expectVisibility(multiZone, false)
      })
    })

    describe('clear()', () => {
      beforeEach(() => {
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(aboveZone1)
        managers.target.findDropZone(mesh, 'box')
      })

      it('clears an active zone', () => {
        expectVisibility(zone1, true)
        managers.target.clear(zone1)
        expectVisibility(zone1, false)
        expect(managers.target.dropOn(zone1)).toEqual([])
      })

      it('ignores unactive zone', () => {
        expectVisibility(zone2, false)
        managers.target.clear(zone2)
        expectVisibility(zone2, false)
        expect(managers.target.dropOn(zone2)).toEqual([])
      })

      it('handles invalid zones', () => {
        managers.target.clear()
        managers.target.clear(null)
        // @ts-expect-error: it's ok to pass random object
        managers.target.clear({})
        expectVisibility(zone1, true)
        expectVisibility(zone2, false)
      })
    })

    describe('dropOn()', () => {
      /** @type {import('@babylonjs/core').Mesh[]} */
      let meshes
      beforeEach(() => {
        meshes = ['box1', 'box2'].map(id => {
          const mesh = createBox(id, {})
          mesh.setAbsolutePosition(aboveZone1)
          managers.target.findDropZone(mesh, 'box')
          return mesh
        })
      })

      it('ignores unactive zone', () => {
        expect(managers.target.dropOn(zone2)).toEqual([])
      })

      it('drops meshes on zone and clear it', () => {
        expectVisibility(zone1, true)
        expect(managers.target.dropOn(zone1)).toEqual(meshes)
        expectVisibility(zone1, false)
      })
    })
  })

  describe('findPlayerZone()', () => {
    /** @type {import('@src/3d/managers').SingleDropZone} */
    let zone1
    /** @type {import('@src/3d/managers').SingleDropZone} */
    let zone2
    /** @type {import('@babylonjs/core').Mesh} */
    let mesh

    beforeEach(() => {
      zone1 = createsTargetZone('target1', {
        position: new Vector3(5, 0, 5),
        playerId
      })
      zone2 = createsTargetZone('target2', {
        position: new Vector3(-5, 0, -5),
        playerId: faker.string.uuid()
      })
      mesh = createBox('box', {})
    })

    it('ignores targets with kinds when providing no kind', () => {
      zone1.kinds = ['card']
      const mesh = createBox('box2', {})
      mesh.setAbsolutePosition(zone1.mesh.absolutePosition)

      expect(managers.target.findPlayerZone(mesh)).toBeNull()
    })

    it('ignores disabled targets', () => {
      zone1.enabled = false
      const mesh = createBox('box2', {})
      mesh.setAbsolutePosition(zone1.mesh.absolutePosition)

      expect(managers.target.findPlayerZone(mesh)).toBeNull()
    })

    it('ignores target part of the current selection', () => {
      managers.selection.select(
        /** @type {import('@babylonjs/core').Mesh} */ (zone1.targetable.mesh)
      )
      const mesh = createBox('box2', {})
      mesh.setAbsolutePosition(zone1.mesh.absolutePosition)

      expect(managers.target.findPlayerZone(mesh)).toBeNull()
    })

    it('ignores targets from different scene', () => {
      const mesh = createBox('box', {}, handScene)
      expect(managers.target.findPlayerZone(mesh)).toBeNull()
    })

    it('returns kind-less targets for provided kind', () => {
      expectActiveZone(
        managers.target.findPlayerZone(mesh, 'box'),
        zone1,
        color
      )
    })

    it('returns targets with matching kind', () => {
      const zone3 = createsTargetZone('target', {
        priority: 1,
        playerId,
        kinds: ['card', 'box']
      })
      expectActiveZone(
        managers.target.findPlayerZone(mesh, 'box'),
        zone3,
        color
      )
    })

    it('returns highest target', () => {
      const zone3 = createsTargetZone('target3', {
        position: new Vector3(0, 1, 0),
        playerId
      })
      expectActiveZone(
        managers.target.findPlayerZone(mesh, 'box'),
        zone3,
        color
      )
    })

    describe('clear()', () => {
      beforeEach(() => {
        managers.target.findPlayerZone(mesh, 'box')
      })

      it('clears an active zone', () => {
        expectVisibility(zone1, true)
        managers.target.clear(zone1)
        expectVisibility(zone1, false)
        expect(managers.target.dropOn(zone1)).toEqual([])
      })

      it('ignores unactive zone', () => {
        expectVisibility(zone2, false)
        managers.target.clear(zone2)
        expectVisibility(zone2, false)
        expect(managers.target.dropOn(zone2)).toEqual([])
      })
    })

    describe('dropOn()', () => {
      /** @type {import('@babylonjs/core').Mesh[]} */
      let meshes
      beforeEach(() => {
        meshes = ['box1', 'box2'].map(id => {
          const mesh = createBox(id, {})
          managers.target.findPlayerZone(mesh, 'box')
          return mesh
        })
      })

      it('ignores unactive zone', () => {
        expect(managers.target.dropOn(zone2)).toEqual([])
      })

      it('drops meshes on zone and clear it', () => {
        expectVisibility(zone1, true)
        expect(managers.target.dropOn(zone1)).toEqual(meshes)
        expectVisibility(zone1, false)
      })
    })
  })

  describe('canAccept()', () => {
    it('returns false without a zone', () => {
      expect(managers.target.canAccept()).toBe(false)
    })

    describe('given a kindless zone', () => {
      /** @type {Partial<import('@src/3d/managers').SingleDropZone>} */
      let zone

      beforeEach(() => {
        zone = { enabled: true }
      })

      it('returns true without kind', () => {
        expect(managers.target.canAccept(zone)).toBe(true)
      })

      it('returns true with kind', () => {
        expect(managers.target.canAccept(zone, 'die')).toBe(true)
      })

      it('returns false when disabled', () => {
        zone.enabled = false
        expect(managers.target.canAccept(zone)).toBe(false)
      })
    })

    describe('given a zone with kind', () => {
      /** @type {Partial<import('@src/3d/managers').SingleDropZone>} */
      let zone

      beforeEach(() => {
        zone = { enabled: true, kinds: ['card', 'token'] }
      })

      it('returns false without kind', () => {
        expect(managers.target.canAccept(zone)).toBe(false)
      })

      it('returns false with unexpected kind', () => {
        expect(managers.target.canAccept(zone, 'die')).toBe(false)
      })

      it('returns true with expected kind', () => {
        expect(managers.target.canAccept(zone, 'token')).toBe(true)
      })

      it('returns false when disabled', () => {
        zone.enabled = false
        expect(managers.target.canAccept(zone, 'token')).toBe(false)
      })
    })
  })

  function createsTargetZone(
    /** @type {string} */ id,
    /** @type {Record<string, ?> & Partial<{ position: Vector3, scene: import('@babylonjs/core').Scene }>} */
    { position = Vector3.Zero(), scene: usedScene, ...properties }
  ) {
    const targetable = createBox(`targetable-${id}`, {}, usedScene ?? scene)
    targetable.isPickable = false
    const behavior = new TargetBehavior({}, managers)
    behavior.onDropObservable.add(drop => drops.push(drop))
    targetable.addBehavior(behavior, true)

    const target = createBox(id, { height: 0.1 }, usedScene ?? scene)
    target.setAbsolutePosition(position)
    return behavior.addZone(target, { extent: 0.5, ...properties })
  }

  function expectActiveZone(
    /** @type {?import('@src/3d/managers').DropZone} */ actual,
    /** @type {Partial<import('@src/3d/managers').DropZone>} */ expected,
    /** @type {string} */ color
  ) {
    expect(actual?.mesh.id).toEqual(expected.mesh?.id)
    expectVisibility(actual, true)
    expect(
      /** @type {?} */ (actual?.mesh.material)?.diffuseColor?.toHexString()
    ).toEqual(color.slice(0, -2))
  }

  function expectVisibility(
    /** @type {?import('@src/3d/managers').DropZone} */ zone,
    /** @type {boolean} */ isVisible
  ) {
    expect(zone?.mesh.visibility).toEqual(isVisible ? 1 : 0)
  }
})
