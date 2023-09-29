<script>
  // @ts-check
  import { Button, Input } from '@src/components'
  import { afterUpdate, createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import Day from './Day.svelte'
  import HistoryRecord from './HistoryRecord.svelte'
  import Message from './Message.svelte'

  /** @type {import('@tabulous/types').Message[]|undefined} discussion thread. */
  export let thread
  /** @type {import('@tabulous/types').HistoryRecord[]|undefined} action history. */
  export let history
  /** @type {number} rank in the game history. */
  export let replayRank = 0
  /** @type {Map<string, import('@src/stores').PlayerWithPref>} a map of player details by their id. */
  export let playerById
  /** @type {string} id of the current player */
  export let currentPlayerId

  /** @type {import('svelte').EventDispatcher<{ sendMessage: { text: string }, replay: number }>} */
  const dispatch = createEventDispatcher()
  let text = ''
  /** @type {?HTMLDivElement} */
  let messageContainer = null

  /** @type {(import('@tabulous/types').Message|{rank: number} & import('@tabulous/types').HistoryRecord|{ time: number })[]} */
  let items = []
  let messageCount = 0

  $: {
    items = []
    const days = new Set()
    for (const [rank, item] of (history ?? []).entries()) {
      days.add(getDay(item.time))
      items.push({ ...item, rank })
    }
    for (const item of thread ?? []) {
      days.add(getDay(item.time))
      items.push(item)
    }
    items.push(...[...days].map(time => ({ time })))
    items.sort((a, b) => a.time - b.time)
  }

  afterUpdate(() => {
    if (items.length > messageCount) {
      // automatically scrolls to last when receiving a new message
      messageContainer?.lastElementChild?.scrollIntoView?.()
    }
    messageCount = items.length
  })

  function handleSend() {
    dispatch('sendMessage', { text })
    text = ''
  }

  function getDay(/** @type {number} */ time) {
    const day = new Date(time)
    day.setHours(0, 0, 0, 0)
    return day.getTime()
  }
</script>

<div class="discussion">
  <h3>{$_('titles.discussion')}</h3>
  <div class="messages" bind:this={messageContainer}>
    {#each items as item}
      {#if 'playerId' in item}
        {@const player = playerById.get(item.playerId)}
        {#if 'rank' in item}{#if !item.fromHand || currentPlayerId === item.playerId}<HistoryRecord
              {player}
              {item}
              isActive={item.rank === replayRank}
              on:click={() =>
                dispatch('replay', /** @type {{rank: number}} */ (item).rank)}
            />
          {/if}{:else}<Message {player} {item} />{/if}
      {:else}
        <Day time={item.time} />
      {/if}
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
    @apply flex flex-col overflow-auto px-4 py-6 justify-end;
  }

  .messages {
    @apply grid grid-cols-[auto,1fr] overflow-y-auto items-center;
  }

  form {
    @apply flex gap-4 items-center;
  }
</style>
