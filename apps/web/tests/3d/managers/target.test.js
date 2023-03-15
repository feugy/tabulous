import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import { MoveBehavior, TargetBehavior } from '@src/3d/behaviors'
import { selectionManager, targetManager as manager } from '@src/3d/managers'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine, createBox } from '../../test-utils'

describe('TargetManager', () => {
  let drops
  let scene
  let handScene

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
  })

  beforeAll(() => selectionManager.init({ scene, color: '#FF00FF' }))

  beforeEach(() => {
    vi.resetAllMocks()
    drops = []
  })

  it('has initial state', () => {
    expect(manager.scene).toBeNull()
    expect(manager.playerId).toBeNull()
  })

  describe('init()', () => {
    it('sets scene', () => {
      const playerId = faker.datatype.uuid()
      const color = faker.color.rgb()
      const overlayAlpha = Math.random()
      manager.init({ scene, playerId, color, overlayAlpha })
      expect(manager.scene).toEqual(scene)
      expect(manager.playerId).toEqual(playerId)
    })
  })

  describe('given an initialized manager', () => {
    const playerId = faker.datatype.uuid()
    const color = '#00FF00FF'

    beforeAll(() => manager.init({ scene, playerId, color, overlayAlpha: 0.2 }))

    describe('registerTargetable()', () => {
      it('registers a mesh', () => {
        const mesh = createBox('box3', {})
        mesh.addBehavior(new TargetBehavior(), true)
        expect(manager.isManaging(mesh)).toBe(true)
      })

      it('automatically unregisters a mesh upon disposal', () => {
        const mesh = createBox('box3', {})
        mesh.addBehavior(new TargetBehavior(), true)
        expect(manager.isManaging(mesh)).toBe(true)

        mesh.dispose()
        expect(manager.isManaging(mesh)).toBe(false)
      })

      it('automatically unregisters a mesh upon behavior detachment', () => {
        const mesh = createBox('box3', {})
        const behavior = new TargetBehavior()
        mesh.addBehavior(behavior, true)
        expect(manager.isManaging(mesh)).toBe(true)

        behavior.detach()
        expect(manager.isManaging(mesh)).toBe(false)
      })

      it('handles invalid behavior', () => {
        const behavior = new TargetBehavior()
        manager.registerTargetable(behavior)
        manager.registerTargetable()
      })
    })

    describe('unregisterTargetable()', () => {
      it('handles invalid behavior', () => {
        const behavior = new TargetBehavior()
        manager.unregisterTargetable(behavior)
        manager.unregisterTargetable()
      })
    })

    describe('findDropZone()', () => {
      let zone1
      let zone2
      const aboveZone1 = new Vector3(5, 1, 5)
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
        expect(manager.findDropZone(createBox('box', {}))).toBeNull()
      })

      it('returns targets below mesh', () => {
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(aboveZone1)

        expectActiveZone(manager.findDropZone(mesh), zone1, color)
      })

      it('ignores an overlaping target when mesh is too far from center', () => {
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(aboveZone1.add(new Vector3(1, 0, 0)))

        expect(manager.findDropZone(mesh)).toBeNull()
      })

      it('ignores targets with kinds below kind-less mesh', () => {
        zone1.kinds = ['card']
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(aboveZone1)

        expect(manager.findDropZone(mesh)).toBeNull()
      })

      it('ignores disabled targets', () => {
        zone1.enabled = false
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(aboveZone1)

        expect(manager.findDropZone(mesh)).toBeNull()
      })

      it('ignores target part of the current selection', () => {
        selectionManager.select(zone1.targetable.mesh)
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(zone1.mesh.absolutePosition)

        expect(manager.findDropZone(mesh)).toBeNull()
      })

      it('ignores targets from different scene', () => {
        const handMesh = createBox('box', {}, handScene)
        handMesh.setAbsolutePosition(aboveZone2)
        expect(manager.findDropZone(handMesh)).toBeNull()

        createsTargetZone('target3', {
          position: new Vector3(10, 0, 10),
          scene: handScene
        })
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(aboveZone3)
        expect(manager.findDropZone(mesh)).toBeNull()
      })

      it('ignores targets with another player Id', () => {
        createsTargetZone('target3', {
          position: new Vector3(10, 0, 10),
          playerId: faker.datatype.uuid(),
          scene
        })
        const mesh = createBox('box', {}, scene)
        mesh.setAbsolutePosition(aboveZone3)

        expect(manager.findDropZone(mesh)).toBeNull()
      })

      it('returns targets with same playerId below mesh with kind', () => {
        const zone3 = createsTargetZone('target3', {
          position: new Vector3(10, 0, 10),
          playerId,
          scene
        })
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(aboveZone3)

        expectActiveZone(manager.findDropZone(mesh, 'box'), zone3, color)
      })

      it('returns kind-less targets below mesh with kind', () => {
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(aboveZone1)

        expectActiveZone(manager.findDropZone(mesh, 'box'), zone1, color)
      })

      it('returns targets below mesh with matching kind', () => {
        zone1.kinds = ['card', 'box']
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(aboveZone2)

        expectActiveZone(manager.findDropZone(mesh, 'box'), zone2, color)
      })

      it('returns highest target below mesh regardless of priorities', () => {
        createsTargetZone('target3', {
          position: new Vector3(0, 0, 0),
          priority: 10
        })
        const zone4 = createsTargetZone('target4', {
          position: new Vector3(0, 1, 0)
        })
        createsTargetZone('target5', { position: new Vector3(0, 0.5, 0) })

        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(new Vector3(0, 5, 0))

        expectActiveZone(manager.findDropZone(mesh, 'box'), zone4, color)
      })

      it('returns highest priority target below mesh', () => {
        createsTargetZone('target3', new Vector3(0, 0, 0))
        const zone4 = createsTargetZone('target4', {
          position: new Vector3(0, 0, 0),
          priority: 2
        })
        createsTargetZone('target5', {
          position: new Vector3(0, 0, 0),
          priority: 1
        })

        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(new Vector3(0, 5, 0))

        expectActiveZone(manager.findDropZone(mesh, 'box'), zone4, color)
      })

      describe('given a mesh with parts', () => {
        let mesh

        beforeEach(() => {
          mesh = createBox('multi-box', { width: 2 })
          mesh.addBehavior(
            new MoveBehavior({ partCenters: [{ x: 0.5 }, { x: 1.5 }] }),
            true
          )
          mesh.setAbsolutePosition(new Vector3(0, 1, 0))
        })

        it('returns a multi drop zone', () => {
          const zone4 = createsTargetZone('target4', {
            position: new Vector3(0, 0, 0)
          })
          const zone5 = createsTargetZone('target5', {
            position: new Vector3(1, 0, 0)
          })

          expect(manager.findDropZone(mesh, 'box')).toEqual({
            parts: [zone4, zone5],
            mesh: zone4.mesh,
            targetable: zone4.targetable
          })
        })

        it('returns null when at least one part is not covered', () => {
          createsTargetZone('target4', { position: new Vector3(0, 0, 0) })
          createsTargetZone('target5', { position: new Vector3(-1, 0, 0) })

          expect(manager.findDropZone(mesh, 'box')).toBeNull()
        })

        it('clears an active multi zone', () => {
          createsTargetZone('target4', { position: new Vector3(0, 0, 0) })
          createsTargetZone('target5', { position: new Vector3(1, 0, 0) })

          const multiZone = manager.findDropZone(mesh, 'box')
          expectVisibility(multiZone, true)
          manager.clear(multiZone)
          expectVisibility(multiZone, false)
        })
      })

      describe('clear()', () => {
        beforeEach(() => {
          const mesh = createBox('box', {})
          mesh.setAbsolutePosition(aboveZone1)
          manager.findDropZone(mesh, 'box')
        })

        it('clears an active zone', () => {
          expectVisibility(zone1, true)
          manager.clear(zone1)
          expectVisibility(zone1, false)
          expect(manager.dropOn(zone1)).toEqual([])
        })

        it('ignores unactive zone', () => {
          expectVisibility(zone2, false)
          manager.clear(zone2)
          expectVisibility(zone2, false)
          expect(manager.dropOn(zone2)).toEqual([])
        })

        it('handles invalid zones', () => {
          manager.clear()
          manager.clear(null)
          manager.clear({})
          expectVisibility(zone1, true)
          expectVisibility(zone2, false)
        })
      })

      describe('dropOn()', () => {
        let meshes = ['box1', 'box2']
        beforeEach(() => {
          meshes = meshes.map(id => {
            const mesh = createBox(id, {})
            mesh.setAbsolutePosition(aboveZone1)
            manager.findDropZone(mesh, 'box')
            return mesh
          })
        })

        it('ignores unactive zone', () => {
          expect(manager.dropOn(zone2)).toEqual([])
        })

        it('drops meshes on zone and clear it', () => {
          expectVisibility(zone1, true)
          expect(manager.dropOn(zone1)).toEqual(meshes)
          expectVisibility(zone1, false)
        })
      })
    })

    describe('findPlayerZone()', () => {
      let zone1
      let zone2
      let mesh

      beforeEach(() => {
        zone1 = createsTargetZone('target1', {
          position: new Vector3(5, 0, 5),
          playerId
        })
        zone2 = createsTargetZone('target2', {
          position: new Vector3(-5, 0, -5),
          playerId: faker.datatype.uuid()
        })
        mesh = createBox('box', {})
      })

      it('ignores targets with kinds when providing no kind', () => {
        zone1.kinds = ['card']
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(zone1.mesh.absolutePosition)

        expect(manager.findPlayerZone(mesh)).toBeNull()
      })

      it('ignores disabled targets', () => {
        zone1.enabled = false
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(zone1.mesh.absolutePosition)

        expect(manager.findPlayerZone(mesh)).toBeNull()
      })

      it('ignores target part of the current selection', () => {
        selectionManager.select(zone1.targetable.mesh)
        const mesh = createBox('box', {})
        mesh.setAbsolutePosition(zone1.mesh.absolutePosition)

        expect(manager.findPlayerZone(mesh)).toBeNull()
      })

      it('ignores targets from different scene', () => {
        const mesh = createBox('box', {}, handScene)
        expect(manager.findPlayerZone(mesh)).toBeNull()
      })

      it('returns kind-less targets for provided kind', () => {
        expectActiveZone(manager.findPlayerZone(mesh, 'box'), zone1, color)
      })

      it('returns targets with matching kind', () => {
        const zone3 = createsTargetZone('target', {
          priority: 1,
          playerId,
          kinds: ['card', 'box']
        })
        expectActiveZone(manager.findPlayerZone(mesh, 'box'), zone3, color)
      })

      it('returns highest target', () => {
        const zone3 = createsTargetZone('target3', {
          position: new Vector3(0, 1, 0),
          playerId
        })
        expectActiveZone(manager.findPlayerZone(mesh, 'box'), zone3, color)
      })

      describe('clear()', () => {
        beforeEach(() => {
          manager.findPlayerZone(mesh, 'box')
        })

        it('clears an active zone', () => {
          expectVisibility(zone1, true)
          manager.clear(zone1)
          expectVisibility(zone1, false)
          expect(manager.dropOn(zone1)).toEqual([])
        })

        it('ignores unactive zone', () => {
          expectVisibility(zone2, false)
          manager.clear(zone2)
          expectVisibility(zone2, false)
          expect(manager.dropOn(zone2)).toEqual([])
        })
      })

      describe('dropOn()', () => {
        let meshes = ['box1', 'box2']
        beforeEach(() => {
          meshes = meshes.map(id => {
            const mesh = createBox(id, {})
            manager.findPlayerZone(mesh, 'box')
            return mesh
          })
        })

        it('ignores unactive zone', () => {
          expect(manager.dropOn(zone2)).toEqual([])
        })

        it('drops meshes on zone and clear it', () => {
          expectVisibility(zone1, true)
          expect(manager.dropOn(zone1)).toEqual(meshes)
          expectVisibility(zone1, false)
        })
      })
    })

    describe('canAccept()', () => {
      it('returns false without a zone', () => {
        expect(manager.canAccept()).toBe(false)
      })

      describe('given a kindless zone', () => {
        let zone

        beforeEach(() => {
          zone = { enabled: true }
        })

        it('returns true without kind', () => {
          expect(manager.canAccept(zone)).toBe(true)
        })

        it('returns true with kind', () => {
          expect(manager.canAccept(zone, 'die')).toBe(true)
        })

        it('returns false when disabled', () => {
          zone.enabled = false
          expect(manager.canAccept(zone)).toBe(false)
        })
      })

      describe('given a zone with kind', () => {
        let zone

        beforeEach(() => {
          zone = { enabled: true, kinds: ['card', 'token'] }
        })

        it('returns false without kind', () => {
          expect(manager.canAccept(zone)).toBe(false)
        })

        it('returns false with unexpected kind', () => {
          expect(manager.canAccept(zone, 'die')).toBe(false)
        })

        it('returns true with expected kind', () => {
          expect(manager.canAccept(zone, 'token')).toBe(true)
        })

        it('returns false when disabled', () => {
          zone.enabled = false
          expect(manager.canAccept(zone, 'token')).toBe(false)
        })
      })
    })
  })

  function createsTargetZone(
    id,
    { position = new Vector3(0, 0, 0), scene: usedScene, ...properties }
  ) {
    const targetable = createBox(`targetable-${id}`, {}, usedScene ?? scene)
    targetable.isPickable = false
    const behavior = new TargetBehavior()
    behavior.onDropObservable.add(drop => drops.push(drop))
    targetable.addBehavior(behavior, true)

    const target = createBox(id, { height: 0.1 }, usedScene ?? scene)
    target.setAbsolutePosition(position)
    return behavior.addZone(target, { extent: 0.5, ...properties })
  }

  function expectActiveZone(actual, expected, color) {
    expect(actual.mesh.id).toEqual(expected.mesh.id)
    expectVisibility(actual, true)
    expect(actual.mesh.material?.diffuseColor?.toHexString()).toEqual(color)
  }

  function expectVisibility(zone, isVisible) {
    expect(zone.mesh.visibility).toEqual(isVisible ? 1 : 0)
  }
})
