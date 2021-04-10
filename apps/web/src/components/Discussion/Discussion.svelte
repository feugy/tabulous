<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  export let thread

  const dispatch = createEventDispatcher()
  let text
</script>

<style type="postcss">
  aside {
    @apply absolute z-10 bg-white flex flex-col left-2 top-2 p-2;
    height: 30%;
  }
  .discussion {
    @apply grid flex-grow overflow-y-auto;
    grid-template-columns: auto 1fr;

    & > * {
      @apply pb-2;
    }
  }
  .from {
    @apply text-right font-medium text-gray-300 pr-2;
  }
</style>

<aside>
  <div class="discussion">
    {#each thread || [] as { peer, message }}
      <span class="from">{peer}</span><span class="message">{message}</span>
    {/each}
  </div>
  <form on:submit|preventDefault={() => dispatch('sendMessage', { text })}>
    <input bind:value={text} />
    <button type="submit">{$_('send')}</button>
  </form>
</aside>
