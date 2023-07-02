<script>
  import { stream$ } from '@src/stores/stream'
  import { _ } from 'svelte-intl'

  import PlayerThumbnail from '../PlayerThumbnail.svelte'

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
</script>

<section data-testid="player-avatar">
  <video class:hasStream autoplay muted={isLocal} bind:this={video} />
  {#if !hasStream}<PlayerThumbnail {player} dimension={150} />{/if}
  {#if player?.isHost}
    <span class="host">{$_('host')}</span>
  {/if}
  {#if muted && !isLocal}
    <legend>
      <span class="material-icons muted">mic_off</span>
    </legend>
  {/if}
</section>

<style lang="postcss">
  section {
    @apply inline-flex relative items-center justify-center overflow-hidden;
  }

  video {
    @apply w-full h-full object-cover hidden;

    &.hasStream {
      @apply block bg-black;
    }
  }

  legend {
    @apply absolute bottom-4 left-1/2 transform-gpu -translate-x-1/2 flex gap-2 z-10;

    .muted {
      @apply text-$ink bg-$disabled rounded-full p-2 w-full h-full;
    }
  }

  .host {
    @apply absolute top-2 right-2 bg-$primary-light px-2 py-1 text-xs;
  }
</style>
