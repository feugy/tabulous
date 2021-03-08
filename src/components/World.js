import { Scene, Color } from 'three'
import { BehaviorSubject } from 'rxjs'
import createCamera from './Camera'
import createDragManager from './DragManager'
import createLight from './Light'
import createRenderer from './Renderer'

export default function create({ container } = {}) {
  const $worldWidth = new BehaviorSubject()
  const $worldHeight = new BehaviorSubject()

  const scene = new Scene()
  scene.background = new Color(0xeeeeee)
  const camera = createCamera()
  const renderer = createRenderer({ scene, camera: camera.instance })
  const light = createLight()
  const dragManager = createDragManager({
    $worldWidth,
    $worldHeight,
    camera: camera.instance
  })

  function handleResize() {
    const { width, height } = container.getBoundingClientRect()
    camera.instance.aspect = width / height
    camera.instance.updateProjectionMatrix()
    renderer.instance.setSize(width, height)
    renderer.instance.setPixelRatio(window.devicePixelRatio)
    $worldWidth.next(width)
    $worldHeight.next(height)
  }

  window.addEventListener('resize', handleResize)

  container.appendChild(renderer.instance.domElement)
  scene.add(camera.instance, light.instance)
  handleResize()
  renderer.addUpdatable(camera)
  return {
    scene,
    camera,
    renderer,
    dispose() {
      window.removeEventListener('resize', handleResize)
      camera.dispose()
      renderer.dispose()
      dragManager.dispose()
    }
  }
}
