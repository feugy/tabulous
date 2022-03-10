<script>
  import { _ } from 'svelte-intl'
  import RadialMenu from './RadialMenu.svelte'
  import { shuffle } from '../utils'
  import { getMeshScreenPosition } from '../3d/utils'

  export let mesh
  export let playerId

  let open = false
  let x = 0
  let y = 0
  let actions = []

  $: {
    actions = []
    open = Boolean(mesh)
    if (open) {
      ;({ x, y } = getMeshScreenPosition(mesh)) // eslint-disable-line no-extra-semi
      if (mesh.metadata.flip) {
        actions.push({
          icon: 'flip',
          title: $_('tooltips.flip'),
          onClick: () => mesh.metadata.flip()
        })
      }
      if (mesh.metadata.rotate) {
        actions.push({
          icon: 'rotate_right',
          title: $_('tooltips.rotate'),
          onClick: () => mesh.metadata.rotate()
        })
      }
      if (mesh.metadata.stack?.length > 1) {
        actions.push({
          icon: 'shuffle',
          title: $_('tooltips.shuffle'),
          onClick: () => {
            const ids = mesh.metadata.stack.map(({ id }) => id)
            mesh.metadata.reorder(shuffle(ids))
          }
        })
      }
      if (mesh.metadata.detail) {
        actions.push({
          icon: 'visibility',
          title: $_('tooltips.detail'),
          onClick: () => mesh.metadata.detail()
        })
      }
      if (mesh.metadata.draw) {
        actions.push({
          icon: 'front_hand',
          title: $_('tooltips.draw'),
          onClick: () => mesh.metadata.draw(playerId)
        })
      }
    }
  }
</script>

<RadialMenu {x} {y} {open} items={actions} />
