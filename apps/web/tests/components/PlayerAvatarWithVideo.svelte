<script>
  import { PlayerAvatar } from '@src/components'
  import { acquireMediaStream, releaseMediaStream } from '@src/stores'
  import { onDestroy, onMount } from 'svelte'

  // Because Atelier loads all the tool files at startup, we need this file to only acquire and release media on demand.
  onMount(acquireMediaStream)
  onDestroy(releaseMediaStream)
</script>

<PlayerAvatar {...$$restProps} />
