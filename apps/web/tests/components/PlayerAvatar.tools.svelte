<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import PlayerAvatarWithVideo from './PlayerAvatarWithVideo.svelte'
  import avatar from './avatar.png'

  let player = { username: 'Joe le clodo', avatar, isHost: true }
</script>

<ToolBox
  name="Components/Player Avatar"
  component={PlayerAvatarWithVideo}
  props={{ player }}
  events={['mute', 'stop']}
  layout="centered"
>
  <Tool name="With video" props={{ controllable: true }} />
  <Tool name="With uncontrollable video" />
  <Tool name="No video" props={{ stream: null }} />
  <Tool
    name="No video nor avatar"
    props={{ stream: null, player: { ...player, avatar: undefined } }}
  />
</ToolBox>
