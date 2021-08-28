<script>
  import { onDestroy } from 'svelte'

  export let size
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

<style type="postcss">
  menu {
    @apply absolute pointer-events-none m-0;

    & > * {
      @apply absolute invisible top-0 left-0;
    }
  }

  div.stackSize {
    @apply inline-block h-auto w-auto -mt-8 ml-4 font-bold text-xl;
    color: theme('colors.primary.text');
    -webkit-text-stroke-width: 1px;
    -webkit-text-stroke-color: theme('colors.primary.dark');

    &.active {
      @apply visible;
    }
  }

  div.halo {
    @apply w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2;
    animation-duration: 750ms;
    transform-origin: top left;
    box-shadow: 0 0 0.15rem 0 lime;
  }

  @keyframes -global-halo {
    0% {
      visibility: visible;
      opacity: 1;
      scale: 1;
    }
    40% {
      scale: 5;
      opacity: 1;
    }
    50% {
      scale: 6;
      opacity: 0;
    }
    51% {
      scale: 2;
      opacity: 1;
    }
    90% {
      scale: 6;
      opacity: 1;
    }
    100% {
      visibility: hidden;
      scale: 7;
      opacity: 0;
    }
  }
</style>

<svelte:body on:mousemove={event => (position = event)} />
<menu style={`left: ${position?.x}px; top: ${position?.y}px`}>
  <div class="stackSize" class:active={Boolean(size)}>
    {size}
  </div>
  <div class="halo" bind:this={halo} on:animationend={handleHaloEnd} />
</menu>
