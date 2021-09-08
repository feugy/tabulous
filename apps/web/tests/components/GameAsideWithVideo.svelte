<script>
  import { GameAside } from '../../src/components'

  export let stream
  export let connected

  $: if (stream === undefined) {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(data => {
        stream = data
      })
  }

  $: connectedWithStream = connected
    ? [{ ...connected[0], stream }, ...connected.slice(1)]
    : connected

  $: console.log(connectedWithStream)
</script>

<GameAside {...$$restProps} connected={connectedWithStream} on:sendToThread />
