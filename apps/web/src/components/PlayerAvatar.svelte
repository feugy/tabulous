<script>
  import { Button } from '.'
  export let stream = null
  export let player = null
  export let controllable = true

  let video
  let noImage = false
  let hasImage = false
  let hasAudio = false
  let muted = false
  let hasVideo = false
  let stopped = false

  $: hasStream = Boolean(stream)

  $: if (hasStream && video) {
    video.srcObject = stream
    hasAudio = stream.getAudioTracks().length > 0
    muted = !hasAudio
    hasVideo = stream.getVideoTracks().length > 0
    stopped = !hasVideo
  }

  function toggleMic() {
    muted = !muted
    for (const track of stream.getAudioTracks()) {
      track.enabled = !muted
    }
  }

  function toggleVideo() {
    stopped = !stopped
    for (const track of stream.getVideoTracks()) {
      track.enabled = !stopped
    }
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
</style>

<figure class:hasStream class:noImage>
  {#if hasStream}
    <figcaption>{player?.username}</figcaption>
    <!-- svelte-ignore a11y-media-has-caption -->
    <video class:stopped autoplay muted={controllable} bind:this={video} />
    <legend>
      {#if controllable}
        {#if hasAudio}<Button
            icon={!muted ? 'mic' : 'mic_off'}
            on:click={toggleMic}
          />{/if}
        {#if hasVideo}<Button
            icon={!stopped ? 'videocam' : 'videocam_off'}
            on:click={toggleVideo}
          />{/if}
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
</figure>
