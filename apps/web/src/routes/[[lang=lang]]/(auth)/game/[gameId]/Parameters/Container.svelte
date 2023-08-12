<script>
  // @ts-check
  /**
   * @typedef {Partial<import('@tabulous/server/src/services/catalog').Schema<?>>} Schema
   * @typedef {import('@src/types').JSONValue} JSONValue
   */

  import { Button, Pane } from '@src/components'
  import { createEventDispatcher } from 'svelte'
  import { fly } from 'svelte/transition'
  import { _ } from 'svelte-intl'

  import { buildComponents } from './utils'

  /** @type {Schema} enforced JSON Schema object */
  export let schema

  /** @type {JSONValue} */
  let values = {}
  $: components = buildComponents(values, schema)

  /** @type {import('svelte').EventDispatcher<{ submit: JSONValue }>} */
  const dispatch = createEventDispatcher()
  const duration = 300

  function handleSubmit() {
    dispatch('submit', values)
  }
</script>

<form
  role="dialog"
  on:submit|preventDefault|stopPropagation={handleSubmit}
  in:fly|global={{ y: -100, duration }}
>
  <Pane title={$_('titles.game-parameters')} backgroundColor="primary">
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
    box-shadow: 0 10px 8px var(--shadow-color);
  }

  section {
    @apply min-w-min gap-4 my-8 grid grid-cols-[1fr,auto];
  }

  div {
    @apply text-center;
  }
</style>
