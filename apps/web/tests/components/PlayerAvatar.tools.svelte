<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import PlayerAvatarWithVideo from './PlayerAvatarWithVideo.svelte'
  import avatar from './avatar.png'

  let player = { username: 'Joe le clodo', avatar }
</script>

<ToolBox
  name="Components/Player Avatar"
  component={PlayerAvatarWithVideo}
  props={{ player }}
  events={['mute', 'stop']}
>
  <Tool name="With video" />
  <Tool name="With uncontrollable video" props={{ controllable: false }} />
  <Tool name="No video" props={{ stream: null }} />
  <Tool
    name="No video nor avatar"
    props={{ stream: null, player: { ...player, avatar: undefined } }}
  />
</ToolBox>
