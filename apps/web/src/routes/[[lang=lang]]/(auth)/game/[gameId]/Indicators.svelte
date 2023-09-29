<script>
  // @ts-check
  import { actionNames } from '@src/3d/utils/actions'
  import { Label, PlayerThumbnail } from '@src/components'

  import Feedback from './Feedback.svelte'

  /** @type {import('@src/stores/indicators').VisibleIndicator[]}*/
  export let items = []
  /** @type {import('@src/stores/indicators').VisibleFeedback[]}*/
  export let feedbacks = []

  $: hashedItems = items.map(item => ({
    ...item,
    hash: `${item.id}-${item.screenPosition.x},${item.screenPosition.y}`
  }))

  function computeLabel(
    /** @type {import('@src/stores').PlayerWithPref|undefined} */ player,
    /** @type {number|undefined} */ size
  ) {
    return player?.username ?? size?.toString() ?? ''
  }

  function computeFeedback(
    /** @type {import('@tabulous/types').ActionName | 'unlock' | 'lock'} */ action
  ) {
    return action === actionNames.push
      ? 'layers'
      : action === actionNames.pop
      ? 'layers_clear'
      : action === actionNames.snap
      ? 'link'
      : action === actionNames.unsnap
      ? 'link_off'
      : action === 'lock'
      ? 'lock'
      : action === 'unlock'
      ? 'lock_open'
      : ''
  }
</script>

{#each hashedItems as { screenPosition, hash, player, onClick, hovered, ...item } (hash)}
  {#if 'mesh' in item}
    <Label
      {screenPosition}
      {onClick}
      {hovered}
      content={computeLabel(player, 'size' in item ? item.size : undefined)}
      color={player?.color}
    />
  {:else}
    <PlayerThumbnail {screenPosition} {player} />
  {/if}
{/each}
{#each feedbacks as { screenPosition, id, player, action } (id)}
  <Feedback
    {screenPosition}
    icon={computeFeedback(action)}
    content={player?.username ?? ''}
    color={player?.color}
  />
{/each}
