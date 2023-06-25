<script>
  import {
    acquireMediaStream,
    cameras$,
    currentCamera$,
    currentMic$,
    mics$,
    recordStreamChange,
    stream$
  } from '@src/stores/stream'

  import Dropdown from '../Dropdown.svelte'
  import SoundMeter from '../SoundMeter.svelte'

  export let muted = false
  export let stopped = false

  function toggleMic() {
    muted = !muted
    for (const track of $stream$.getAudioTracks()) {
      track.enabled = !muted
    }
    recordStreamChange({ muted, stopped })
  }

  function toggleVideo() {
    stopped = !stopped
    for (const track of $stream$.getVideoTracks()) {
      track.enabled = !stopped
    }
    recordStreamChange({ muted, stopped })
  }

  function selectMedia({ detail: media }) {
    acquireMediaStream(media)
  }
</script>

<legend>
  {#if $mics$?.length > 0}
    <SoundMeter mediaStream={$stream$} />
    <Dropdown
      valueAsText={false}
      openOnClick={false}
      icon={!muted ? 'mic' : 'mic_off'}
      value={$currentMic$}
      options={$mics$}
      on:click={toggleMic}
      on:select={selectMedia}
    />
  {/if}
  {#if $cameras$?.length > 0}
    <Dropdown
      valueAsText={false}
      openOnClick={false}
      icon={!stopped ? 'videocam' : 'videocam_off'}
      value={$currentCamera$}
      options={$cameras$}
      on:click={toggleVideo}
      on:select={selectMedia}
    />
  {/if}
</legend>

<style lang="postcss">
  legend {
    @apply flex gap-2 justify-center p-2;
  }
</style>
