import { faker } from '@faker-js/faker'
import { createPeerPointer } from '../../../src/3d/meshes'
import { controlManager } from '../../../src/3d/managers'
import { configures3dTestEngine } from '../../test-utils'

configures3dTestEngine()

describe('createPeerPointer()', () => {
  it('creates peer pointer', () => {
    const id = faker.random.word()
    const peerPointer = createPeerPointer({ id })
    expect(peerPointer.name).toEqual('peer-pointer')
    expect(peerPointer.id).toEqual(id)
    const { boundingBox } = peerPointer.getBoundingInfo()
    expect(boundingBox.extendSize.x * 2).toEqual(0.4)
    expect(boundingBox.extendSize.y * 2).toEqual(0.4)
    expect(peerPointer.isPickable).toBe(false)
    expect(peerPointer.absolutePosition.asArray()).toEqual([0, 0, 0])
    expect(controlManager.isManaging(peerPointer)).toBe(false)
  })
})
