<script>
  import { Button, Input } from '@src/components'
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

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

<div class="discussion">
  <div class="messages" bind:this={messageContainer}>
    {#each thread || [] as { playerId, text }}
      {@const { username, color } = playerById.get(playerId) ?? {
        username: ''
      }}
      <span class="from" style="--player-color:{color};">{username}</span><span
        class="message">{text}</span
      >
    {/each}
  </div>
  <form on:submit|preventDefault={handleSend}>
    <Input bind:value={text} />
    <Button
      type="submit"
      disabled={text?.trim().length === 0}
      title={$_('tooltips.send-message')}
      icon="send"
    />
  </form>
</div>

<style lang="postcss">
  .discussion {
    @apply flex flex-col overflow-auto p-2 shadow-md justify-end h-full;
  }

  .messages {
    @apply flex flex-col overflow-y-auto;

    & > * {
      @apply pb-2;
    }

    & > .message {
      overflow-wrap: anywhere;
    }

    & > .from {
      word-break: break-word;
    }
  }

  .from {
    @apply font-medium pr-2 text-$player-color;
  }

  form {
    @apply flex gap-4 items-center;
  }
</style>
