<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { PeerPointer } from '../../src/components'
  import avatar from './avatar.png'

  let player = { username: 'Joe le clodo', avatar }
  let screenPosition = { x: 0, y: -50 }
</script>

<ToolBox
  name="Components/Peer Pointer"
  component={PeerPointer}
  props={{ player, color: 'lime', screenPosition }}
  layout="centered"
>
  <Tool name="Avatar" />
  <Tool name="No avatar" props={{ player: { ...player, avatar: undefined } }} />
</ToolBox>
