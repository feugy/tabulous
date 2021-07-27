<script>
  import { PlayerAvatar } from '../../src/components'

  export let stream

  $: if (stream === undefined) {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(data => {
        stream = data
      })
  }
</script>

<PlayerAvatar {stream} {...$$restProps} />
