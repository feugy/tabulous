<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { PlayerThumbnail } from '@src/components'
  import avatar from '@tests/fixtures/avatar.png'

  const player = { username: 'Joe le clodo' }
  const screenPosition = { x: 0, y: 150 }
  const dimension = 150
</script>

<ToolBox
  name="Components/Player thumbnail"
  component={PlayerThumbnail}
  props={{ player }}
  layout="centered"
>
  <Tool name="Avatar" props={{ dimension, player: { ...player, avatar } }} />
  <Tool name="Text" props={{ dimension }} />
  <Tool name="Small text" props={{ dimension: 50 }} />
  <Tool
    name="Positionned avatar"
    props={{ player: { ...player, avatar, color: 'lime' }, screenPosition }}
  />
  <Tool
    name="Positioned text"
    props={{ player: { ...player, color: 'red' }, screenPosition }}
  />
</ToolBox>
