import { WebGLRenderer } from 'three'

export default function create({ scene, camera }) {
  const updatables = []
  const instance = new WebGLRenderer()
  instance.physicallyCorrectLights = true

  instance.setAnimationLoop(() => {
    tick()
    instance.render(scene, camera)
  })

  function tick() {
    for (const object of updatables) {
      object.tick()
    }
  }

  return {
    instance,
    addUpdatable(...objects) {
      for (const object of objects) {
        if (!updatables.includes(object)) {
          updatables.push(object)
        }
      }
    },
    removeUpdatable(...objects) {
      for (const object of objects) {
        const idx = updatables.indexOf(object)
        if (idx >= 0) {
          updatables.splice(idx, 1)
        }
      }
    },
    dispose() {
      instance.setAnimationLoop(null)
    }
  }
}
