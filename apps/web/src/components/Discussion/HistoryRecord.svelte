<script>
  // @ts-check
  /**
   * @typedef {import('@src/stores/game-manager').Player} Player
   * @typedef {import('@tabulous/server/src/graphql').HistoryRecord} HistoryRecord
   */

  import { PlayerThumbnail } from '@src/components'
  import { _ } from 'svelte-intl'

  /** @type {Player|undefined} action's author. */
  export let player

  /** @type {HistoryRecord} recorded item. */
  export let item

  /** Whether this record is currently active. */
  export let isActive = false

  // @ts-expect-error : fn does not exist on PlayerMove
  $: label = item.fn ?? 'move'
</script>

<button class:isActive on:click>
  <PlayerThumbnail {player} dimension={30} />
  <span class="time">{$_('{ time, date, time }', item)}</span>
  <span class="message">{$_(`labels.history.${label}`)}</span>
</button>

<style lang="postcss">
  button {
    @apply flex items-center gap-2 col-span-2 rounded-l-full p-2;

    &.isActive {
      @apply bg-$base-lighter;
    }
  }
  .time {
    @apply text-$secondary-light;
  }
  .message {
    @apply text-$base-light;
  }
</style>
