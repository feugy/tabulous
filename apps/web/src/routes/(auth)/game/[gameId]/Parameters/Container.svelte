<script>
  import { Button, Pane } from '@src/components'
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import { buildComponents } from './utils'

  export let schema = {}

  let values = {}
  $: components = buildComponents(values, schema)

  const dispatch = createEventDispatcher()

  function handleSubmit() {
    dispatch('submit', values)
  }
</script>

<form role="dialog" on:submit|preventDefault|stopPropagation={handleSubmit}>
  <Pane title={$_('titles.game-parameters')}>
    <section>
      {#each components as { name, component, property }}
        <svelte:component this={component} {property} {name} bind:values />
      {/each}
    </section>
    <div>
      <Button text={$_('actions.join-game')} type="submit" />
    </div>
  </Pane>
</form>

<style lang="postcss">
  form {
    @apply absolute inset-0 p-16 flex justify-center items-center z-1;
  }

  section {
    @apply min-w-min gap-4 my-8 grid grid-cols-[1fr,auto];
  }

  div {
    @apply text-center;
  }
</style>
