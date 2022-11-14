<script>
  import Message from './Message.svelte'
  export let messages = []

  $: {
    for (const message of messages) {
      if (!message.id) {
        message.id = `${Date.now()}_${Math.floor(Math.random() * 1000)}`
      }
      if (!message.duration) {
        message.duration = 5
      }
      if (!message.timeout) {
        message.timeout = setTimeout(
          () => removeMessage(message.id),
          message.duration * 1100
        )
      }
    }
  }

  function removeMessage(id) {
    const index = messages.findIndex(candidate => candidate.id === id)
    if (index !== -1) {
      messages = [...messages.slice(0, index), ...messages.slice(index + 1)]
    }
  }
</script>

<div>
  {#each messages as { timeout, id, ...message } (id)}
    <Message {...message} />
  {/each}
</div>

<style lang="postcss">
  div {
    @apply flex flex-col items-end absolute z-20 top-8 right-8;
  }
</style>
