<script>
  import { Aside, Button } from '@src/components'
  import { createEventDispatcher } from 'svelte'

  export let withControls = false

  const dispatchEvent = createEventDispatcher()
</script>

<main class="flex w-full h-screen" style="height: 100vh">
  <section class="flex-1">
    {#if withControls}
      <Button icon="add" on:click={() => dispatchEvent('add')} />
      <Button icon="remove" on:click={() => dispatchEvent('remove')} />
    {/if}
  </section>
  <Aside {...$$restProps} on:sendMessage />
</main>
