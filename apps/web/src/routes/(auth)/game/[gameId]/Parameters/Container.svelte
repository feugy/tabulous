<script>
  import { Button, Pane } from '@src/components'
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import Choice from './Choice.svelte'

  export let schema = {}

  $: properties = Object.entries(schema?.properties ?? {})

  const dispatch = createEventDispatcher()
  let selected = {}

  function handleSubmit() {
    const values = {}
    for (const [name, { value }] of Object.entries(selected)) {
      values[name] = value
    }
    dispatch('submit', values)
  }
</script>

<form role="dialog" on:submit|preventDefault|stopPropagation={handleSubmit}>
  <Pane>
    <header class="heading">{$_('titles.game-parameters')}</header>
    <section>
      {#each properties as [name, property]}
        {#if property.enum}
          <Choice {property} {name} bind:value={selected[name]} />
        {/if}
      {/each}
    </section>
    <div>
      <Button text={$_('actions.join-game')} type="submit" />
    </div>
  </Pane>
</form>

<style lang="postcss">
  form {
    @apply absolute inset-0 p-16 flex justify-center items-center;
  }

  section {
    @apply min-w-min gap-4 my-8 grid grid-cols-[1fr,auto];
  }

  div {
    @apply text-center;
  }
</style>
