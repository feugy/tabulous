<script>
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-intl'
  import {
    acquireMediaStream,
    cameras$,
    currentCamera$,
    currentMic$,
    mics$,
    recordStreamChange,
    releaseMediaStream,
    stream$
  } from '../stores/stream'
  import { Dropdown } from '.'
  export let player = null
  export let stream = null
  export let isLocal = false

  let video
  let noImage = false
  let hasImage = false
  let hasAudio = false
  let muted = false
  let hasVideo = false
  let stopped = false

  onDestroy(releaseMediaStream)

  $: if (isLocal && !$stream$) {
    acquireMediaStream()
  }

  $: mediaStream = isLocal ? $stream$ : stream
  $: hasStream = Boolean(mediaStream)

  $: if (hasStream && video) {
    video.srcObject = mediaStream
    hasAudio = mediaStream.getAudioTracks().length > 0
    muted = !hasAudio
    hasVideo = mediaStream.getVideoTracks().length > 0
    stopped = !hasVideo
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

<style lang="postcss">
  figure {
    @apply inline-flex relative items-center justify-center;
    width: 150px;
    height: 150px;

    &.hasStream {
      @apply overflow-hidden bg-black w-full h-full;
    }
  }

  figcaption {
    @apply absolute top-0 left-0 w-full h-full flex items-center justify-center p-4 rounded-full text-$primary-lightest;

    &.noImage {
      @apply bg-$base-dark;
    }
  }

  legend {
    @apply absolute bottom-4 left-1/2 transform-gpu -translate-x-1/2 flex gap-2 z-10;
  }

  img {
    @apply rounded-full border-5 border-$primary-light bg-$primary-lightest h-full;

    &.noImage {
      @apply opacity-0;
    }
  }

  video {
    @apply z-10;

    &.stopped {
      @apply opacity-0;
    }
  }

  label {
    @apply absolute z-10 top-2 right-2 bg-$primary-lightest px-2 py-1 text-xs;
  }
</style>

<figure class:hasStream>
  {#if hasStream}
    <figcaption>{player?.username}</figcaption>
    <!-- svelte-ignore a11y-media-has-caption -->
    <video class:stopped autoplay muted={isLocal} bind:this={video} />
    <legend>
      {#if isLocal}
        {#if hasAudio}
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
        {#if hasVideo}
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
      {/if}
    </legend>
  {:else}
    <!-- svelte-ignore a11y-missing-attribute -->
    <img
      class:noImage
      src={player?.avatar ?? '/no-avatar.png'}
      on:load={() => (hasImage = true)}
      on:error={() => (noImage = true)}
    />
    {#if noImage || !hasImage}
      <figcaption class:noImage>{player?.username}</figcaption>
    {/if}
  {/if}
  {#if player?.isHost}
    <label>{$_('host')}</label>
  {/if}
</figure>
