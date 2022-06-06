<script>
  import { Tool, ToolBox, recordEvent } from '@atelier-wb/svelte'
  import { PlayerAvatar } from '../../src/components'
  import {
    localStreamChange$,
    currentMic$,
    currentCamera$
  } from '../../src/stores'
  import avatar from './avatar.png'

  let player = { username: 'Joe le clodo', avatar, isHost: true }

  localStreamChange$.subscribe(state => recordEvent('change', state))
  currentMic$.subscribe(mic => recordEvent('select-mic', mic?.toJSON()))
  currentCamera$.subscribe(camera =>
    recordEvent('select-camera', camera?.toJSON())
  )
</script>

<ToolBox
  name="Components/Player Avatar"
  component={PlayerAvatar}
  props={{ player }}
  layout="centered"
>
  <Tool name="Local" props={{ isLocal: true }} />
  <Tool name="No video" props={{ stream: null }} />
  <Tool
    name="No video nor avatar"
    props={{ stream: null, player: { ...player, avatar: undefined } }}
  />
</ToolBox>
