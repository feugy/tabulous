<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import Button from './Button.svelte'
  import Input from './Input.svelte'

  export let thread
  export let playerById

  const dispatch = createEventDispatcher()
  let text = ''
  let messageContainer

  $: if (messageContainer && thread) {
    // automatically scrolls to last when receiving a new message
    setTimeout(() => {
      messageContainer?.lastElementChild?.scrollIntoView?.()
    }, 0)
  }

  function handleSend() {
    dispatch('sendMessage', { text })
    text = ''
  }
</script>

<style lang="postcss">
  .discussion {
    @apply flex flex-col overflow-auto p-2 shadow-md justify-end h-full bg-$base-lighter;
  }

  .messages {
    @apply grid overflow-y-auto;
    grid-template-columns: min-content 1fr;

    & > * {
      @apply pb-2;
    }
  }

  .from {
    @apply text-right font-medium pr-2 text-$secondary;
  }

  form {
    @apply flex gap-4 items-center;
  }
</style>

<div class="discussion">
  <div class="messages" bind:this={messageContainer}>
    {#each thread || [] as { playerId, text }}
      <span class="from">{playerById.get(playerId)?.username ?? ''}</span><span
        class="message">{text}</span
      >
    {/each}
  </div>
  <form on:submit|preventDefault={handleSend} on:keydown|stopPropagation>
    <Input bind:value={text} />
    <Button
      type="submit"
      disabled={text?.trim().length === 0}
      title={$_('tooltips.send-message')}
      icon="send"
    />
  </form>
</div>
