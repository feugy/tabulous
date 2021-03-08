<script>
  import { getContext } from 'svelte'
  import { SCENE } from './Scene.svelte'
  import { BoxGeometry, Mesh, MeshPhongMaterial } from 'three'

  export let x = 0
  export let y = 0
  export let width = 100
  export let height = 50
  export let color = 0xcccccc

  const geometry = new BoxGeometry(width, height, 1, 1, 1, 1)
  const material = new MeshPhongMaterial({ color })
  const board = new Mesh(geometry, material)
  board.position.set(x, y, -1)

  const scene = getContext(SCENE)
  scene.add(board)
</script>
