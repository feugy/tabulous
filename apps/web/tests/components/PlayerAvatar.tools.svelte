<script>
  import { recordEvent, Tool, ToolBox } from '@atelier-wb/svelte'
  import { currentCamera$, currentMic$, localStreamChange$ } from '@src/stores'
  import avatar from '@tests/fixtures/avatar.png'

  import PlayerAvatar from './PlayerAvatarWithVideo.svelte'

  let player = { username: 'Joe le clodo', avatar, color: 'red', isHost: true }

  localStreamChange$.subscribe(state => recordEvent('change', state))
  currentMic$.subscribe(mic => recordEvent('select-mic', mic?.toJSON()))
  currentCamera$.subscribe(camera =>
    recordEvent('select-camera', camera?.toJSON())
  )
</script>

<ToolBox
  name="Components/Player Avatar"
  component={PlayerAvatar}
  props={{ player, muted: false, stopped: false }}
  layout="centered"
>
  <Tool name="Local" props={{ isLocal: true }} />
  <Tool name="No video" props={{ stream: null }} />
  <Tool
    name="No video nor avatar"
    props={{
      stream: null,
      player: { ...player, color: null, avatar: undefined }
    }}
  />
</ToolBox>
