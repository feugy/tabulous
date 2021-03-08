<script>
  import { getContext } from 'svelte'
  import { SCENE } from './Scene.svelte'
  import { DirectionalLight } from 'three'

  const light = new DirectionalLight('white', 3)
  light.position.set(0, 0, 10)
  light.castShadow = true

  const scene = getContext(SCENE)
  scene.add(light)
</script>
