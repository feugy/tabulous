<script>
  import { getContext, onMount } from 'svelte'
  import { SCENE } from './Scene.svelte'
  import {
    AnimationClip,
    AnimationMixer,
    BoxBufferGeometry,
    Clock,
    LoopOnce,
    Mesh,
    MeshStandardMaterial,
    TextureLoader,
    VectorKeyframeTrack
  } from 'three'
  import {
    addDraggable,
    removeDraggable,
    registerRenderer,
    unregisterRenderer
  } from '../stores'

  const loader = new TextureLoader()

  export let x = 0
  export let y = 0
  export let width = 3
  export let height = 4.12
  export let sideA = 'images/splendor-1-1.png'

  const geometry = new BoxBufferGeometry(width, height, 0.01, 1, 1, 1)
  const material = new MeshStandardMaterial({ map: loader.load(sideA) })
  const card = new Mesh(geometry, material)
  card.position.set(x, y)

  const scene = getContext(SCENE)
  scene.add(card)
  card.addEventListener('click', () => {
    if (!flipAction.isRunning()) {
      flipAction.play()
    }
  })

  const mixer = new AnimationMixer(card)
  const clock = new Clock()
  const flipAction = mixer.clipAction(
    new AnimationClip('flip', -1, [
      new VectorKeyframeTrack(
        '.position',
        [0, 0.25, 0.5],
        [0, 0, 0, 2, 2, 2, 0, 0, 0]
      )
    ])
  )
  flipAction.loop = LoopOnce

  onMount(() => {
    addDraggable(card)
    registerRenderer(animate)
    return () => {
      removeDraggable(card)
      unregisterRenderer(animate)
    }
  })

  function animate() {
    mixer.update(clock.getDelta())
  }
</script>
