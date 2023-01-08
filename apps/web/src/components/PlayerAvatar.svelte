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
  import { _ } from 'svelte-intl'

  import Dropdown from './Dropdown.svelte'
  import PlayerThumbnail from './PlayerThumbnail.svelte'
  import SoundMeter from './SoundMeter.svelte'

  export let player = null
  export let stream = null
  export let isLocal = false
  export let muted = false
  export let stopped = false

  let video

  $: mediaStream = isLocal ? $stream$ : stream
  $: hasStream = Boolean(mediaStream) && !stopped

  $: if (mediaStream && video) {
    video.srcObject = mediaStream
  }

  function toggleMic() {
    muted = !muted
    for (const track of mediaStream.getAudioTracks()) {
      track.enabled = !muted
    }
    recordStreamChange({ muted, stopped })
  }

  function toggleVideo() {
    stopped = !stopped
    for (const track of mediaStream.getVideoTracks()) {
      track.enabled = !stopped
    }
    recordStreamChange({ muted, stopped })
  }

  function selectMedia({ detail: media }) {
    acquireMediaStream(media)
  }
</script>

<section data-testid="player-avatar">
  <video class:hasStream autoplay muted={isLocal} bind:this={video} />
  {#if !hasStream}<PlayerThumbnail {player} dimension={150} />{/if}
  {#if player?.isHost}
    <span class="host">{$_('host')}</span>
  {/if}
  <legend>
    {#if isLocal}
      {#if $mics$?.length > 0}
        <SoundMeter {mediaStream} />
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
    {:else if muted}
      <span class="material-icons muted">mic_off</span>
    {/if}
  </legend>
</section>

<style lang="postcss">
  section {
    @apply inline-flex relative items-center justify-center w-full h-full overflow-hidden;
  }

  video {
    @apply w-full hidden;

    &.hasStream {
      @apply block bg-black;
    }
  }

  legend {
    @apply absolute bottom-4 left-1/2 transform-gpu -translate-x-1/2 flex gap-2 z-10;

    .muted {
      @apply text-$accent-warm bg-$primary-lightest rounded-full p-2;
    }
  }

  .host {
    @apply absolute top-2 right-2 bg-$primary-lightest px-2 py-1 text-xs;
  }
</style>
