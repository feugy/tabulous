<script>
  import { GameAside } from '../../src/components'

  let localDevices = {
    stream: null,
    currentCamera: null,
    cameras: [],
    currentMic: null,
    mics: []
  }

  $: if (!localDevices.stream) {
    navigator.mediaDevices?.enumerateDevices().then(devices =>
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then(stream => {
          const mics = devices.filter(
            ({ kind, label }) =>
              kind === 'audioinput' && !label.startsWith('Monitor of')
          )
          const cameras = devices.filter(({ kind }) => kind === 'videoinput')
          localDevices = {
            mics,
            cameras,
            currentMic: mics[0],
            currentCamera: cameras[0],
            stream
          }
        })
    )
  }
</script>

<GameAside {...$$restProps} {localDevices} current on:sendToThread />
