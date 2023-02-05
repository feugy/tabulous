<script>
  import { Aside } from '@src/components'
  import { acquireMediaStream, releaseMediaStream } from '@src/stores'
  import { onDestroy, onMount } from 'svelte'

  // Because Atelier loads all the tool files at startup, we need this file to only acquire and release media on demand.
  onMount(acquireMediaStream)
  onDestroy(releaseMediaStream)
</script>

<main class="flex w-full h-screen" style="height: 100vh">
  <section class="flex-1" />
  <Aside {...$$restProps} on:sendMessage />
</main>
