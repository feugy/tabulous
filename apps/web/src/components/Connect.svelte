<script>
  import { _ } from 'svelte-intl'
  import { connectWith, connected, currentPeerId } from '../stores'

  let id
</script>

<style type="postcss">
  aside {
    @apply absolute z-10 bg-white left-2 top-2 p-2;
  }
</style>

{#if $connected.length === 0}
  <aside>
    <div>{$_('peer id _', { value: $currentPeerId })}</div>
    <form on:submit|preventDefault={() => connectWith(id)}>
      <input bind:value={id} />
      <button type="submit">{$_('connect with')}</button>
    </form>
  </aside>
{/if}
