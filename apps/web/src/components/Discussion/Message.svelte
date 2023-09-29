<script>
  // @ts-check
  import { PlayerThumbnail } from '@src/components'
  import { _ } from 'svelte-intl'

  /** @type {import('@src/stores').PlayerWithPref|undefined} message's author. */
  export let player

  /** @type {import('@tabulous/types').Message} message text content. */
  export let item
</script>

<div><PlayerThumbnail {player} dimension={30} /></div>
<span class="time">{$_('{ time, date, time }', item)}</span>
<span class="message">{item.text}</span>

<style lang="postcss">
  div {
    @apply p-2;
  }
  .time {
    @apply text-$secondary;
  }
  .message {
    @apply col-span-2 p-2 pt-0;
    overflow-wrap: anywhere;
  }
</style>
