<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import { Button, Input } from '.'

  export let thread

  const dispatch = createEventDispatcher()
  let text

  function handleSend() {
    dispatch('sendMessage', { text })
    text = ''
  }
</script>

<style type="postcss">
  .discussion {
    @apply flex flex-col p-4;
  }
  .messages {
    @apply grid flex-grow overflow-y-auto;
    grid-template-columns: auto 1fr;

    & > * {
      @apply pb-2;
    }
  }
  .from {
    @apply text-right font-medium pr-2;
    color: theme('colors.secondary.main');
  }
  form {
    @apply flex gap-4;
  }
</style>

<div class="discussion">
  <div class="messages">
    {#each thread || [] as { peer, message }}
      <span class="from">{peer}</span><span class="message">{message}</span>
    {/each}
  </div>
  <form on:submit|preventDefault={handleSend}>
    <Input bind:value={text} />
    <Button secondary type="submit" text={$_('send')} icon="send" />
  </form>
</div>
