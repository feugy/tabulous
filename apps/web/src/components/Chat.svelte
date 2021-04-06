<script>
  import { _ } from 'svelte-intl'
  import { chat, connected, sendMessage } from '../stores'

  let outgoingMessage
</script>

<style type="postcss">
  aside {
    @apply absolute z-10 bg-white flex flex-col left-2 top-2 p-2;
    height: 30%;
  }
  ul {
    @apply flex-grow overflow-y-auto list-none p-0 m-0;
  }
  li {
    padding-bottom: 0.5em;
  }
  .from {
    @apply font-medium text-gray-300;
    padding-right: 0.5em;
  }
</style>

{#if $connected.length}
  <aside>
    <ul>
      {#each $chat || [] as { peer, message }}<li>
          <span class="from">{peer}</span><span class="message">{message}</span>
        </li>{/each}
    </ul>
    <form on:submit|preventDefault={() => sendMessage(outgoingMessage)}>
      <input bind:value={outgoingMessage} />
      <button type="submit">{$_('send')}</button>
    </form>
  </aside>
{/if}
