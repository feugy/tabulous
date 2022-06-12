<script>
  import { _ } from 'svelte-intl'
  import {
    acquireMediaStream,
    cameras$,
    currentCamera$,
    currentMic$,
    mics$,
    recordStreamChange,
    stream$
  } from '../stores/stream'
  import { Dropdown } from '.'

  export let player = null
  export let stream = null
  export let isLocal = false
  export let muted = false
  export let stopped = false

  let video
  let hasAudio = false
  let hasVideo = false

  $: mediaStream = isLocal ? $stream$ : stream
  $: hasStream = Boolean(mediaStream) && !stopped
  $: hasAvatar = Boolean(player?.avatar)

  $: if (hasStream && video) {
    video.srcObject = mediaStream
    hasAudio = mediaStream.getAudioTracks().length > 0
    hasVideo = mediaStream.getVideoTracks().length > 0
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
    @apply inline-flex relative items-center justify-center w-full h-full;

    &.hasStream {
      @apply overflow-hidden bg-black;
    }
  }

  video {
    @apply w-full;
  }

  img {
    @apply rounded-full border-5 border-$primary-light bg-$primary-lightest;
    width: 150px;
    height: 150px;
  }

  figcaption {
    @apply flex items-center justify-center p-4 rounded-full text-$primary-lightest bg-$base-dark m-4;
    width: 150px;
    height: 150px;
  }

  legend {
    @apply absolute bottom-4 left-1/2 transform-gpu -translate-x-1/2 flex gap-2 z-10;

    .muted {
      @apply text-$accent-warm bg-$primary-lightest rounded-full p-2;
    }
  }

  label {
    @apply absolute top-2 right-2 bg-$primary-lightest px-2 py-1 text-xs;
  }
</style>

<figure class:hasStream>
  {#if hasStream}<!-- svelte-ignore a11y-media-has-caption --><video
      autoplay
      muted={isLocal}
      bind:this={video}
    />{:else if hasAvatar}<!-- svelte-ignore a11y-missing-attribute --><img
      src={player?.avatar}
    />{:else}<figcaption>{player?.username}</figcaption>{/if}
  {#if player?.isHost}
    <label>{$_('host')}</label>
  {/if}
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
    {:else if muted}
      <span class="material-icons muted">mic_off</span>
    {/if}
  </legend>
</figure>
