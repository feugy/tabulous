<script>
  import { onDestroy } from 'svelte'

  export let halos
  let halo
  let position
  let haloSubscription

  $: {
    haloSubscription?.unsubscribe()
    if (halos) {
      haloSubscription = halos.subscribe(handleHalo)
    }
  }

  onDestroy(() => {
    haloSubscription?.unsubscribe()
  })

  function handleHalo() {
    if (halo) {
      halo.style.animationName = 'halo'
    }
  }

  function handleHaloEnd() {
    if (halo) {
      halo.style.animationName = ''
    }
  }
</script>

<svelte:body
  on:pointermove={event => (position = event)}
  on:pointerdown={event => (position = event)}
/>
<menu style={`left: ${position?.x}px; top: ${position?.y}px`}>
  <div class="halo" bind:this={halo} on:animationend={handleHaloEnd} />
</menu>

<style lang="postcss">
  menu {
    @apply absolute pointer-events-none m-0;

    & > * {
      @apply absolute invisible top-0 left-0;
    }
  }

  div.halo {
    @apply w-4 h-4 rounded-full -mt-2 -ml-2;
    animation-duration: 400ms;
    transform-origin: center;
    box-shadow: 0 0 0.15rem 0 lime;
  }

  @keyframes -global-halo {
    0% {
      visibility: visible;
      opacity: 1;
      transform: scale(1);
    }
    40% {
      transform: scale(6);
      opacity: 1;
    }
    50% {
      transform: scale(8);
      opacity: 0;
    }
    51% {
      transform: scale(2);
      opacity: 1;
    }
    90% {
      transform: scale(7);
      opacity: 1;
    }
    100% {
      visibility: hidden;
      transform: scale(9);
      opacity: 0;
    }
  }
</style>
