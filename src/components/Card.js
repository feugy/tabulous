import {
  AnimationClip,
  AnimationMixer,
  Clock,
  Group,
  LoopOnce,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneBufferGeometry,
  Quaternion,
  QuaternionKeyframeTrack,
  TextureLoader,
  Vector3,
  VectorKeyframeTrack
} from 'three'

import { addDraggable, removeDraggable } from '../stores'

const loader = new TextureLoader()

export default function create({
  x = 0,
  y = 0,
  width = 3,
  height = 4.12,
  sideA,
  sideB,
  flipDuration = 0.25
} = {}) {
  let isFlipped = false

  const instance = new Object3D()
  instance.position.set(x, y)

  const pivot = new Vector3(0, 1, 0)
  const meshes = [
    new Mesh(
      new PlaneBufferGeometry(width, height),
      new MeshBasicMaterial({
        map: loader.load(sideA)
      })
    ),
    new Mesh(
      new PlaneBufferGeometry(width, height),
      new MeshBasicMaterial({
        map: loader.load(sideB || sideA)
      })
    )
  ]
  meshes[1].quaternion.setFromAxisAngle(pivot, Math.PI)

  const card = new Group()
  card.add(...meshes)
  instance.add(card)

  const mixer = new AnimationMixer(card)
  const clock = new Clock()
  const flip = mixer.clipAction(
    new AnimationClip('flip', -1, [
      new QuaternionKeyframeTrack(
        '.quaternion',
        [0, flipDuration],
        [
          ...new Quaternion().setFromAxisAngle(pivot, 0).toArray(),
          ...new Quaternion().setFromAxisAngle(pivot, Math.PI).toArray()
        ]
      ),
      new VectorKeyframeTrack(
        '.position',
        [0, flipDuration * 0.5, flipDuration],
        [0, 0, 0, 0, 0, 2, 0, 0, 0]
      )
    ])
  )
  flip.loop = LoopOnce

  mixer.addEventListener('finished', () => {
    instance.quaternion.copy(
      new Quaternion().setFromAxisAngle(pivot, isFlipped ? 0 : Math.PI)
    )
    flip.getClip().tracks[1].values[5] *= -1
    isFlipped = !isFlipped
  })

  instance.addEventListener('click', () => {
    if (!flip.isRunning()) {
      flip.reset()
      flip.play()
    }
  })

  addDraggable(instance)

  return {
    instance,
    tick() {
      mixer.update(clock.getDelta())
    },
    dispose() {
      removeDraggable(instance)
    }
  }
}
