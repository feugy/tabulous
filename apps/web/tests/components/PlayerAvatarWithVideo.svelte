<script>
  import { PlayerAvatar } from '../../src/components'

  export let stream = undefined

  $: if (stream === undefined && 'mediaDevices' in navigator) {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(data => {
        stream = data
      })
  }
</script>

<PlayerAvatar {stream} {...$$restProps} />
