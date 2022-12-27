<script>
  import { Label, PlayerThumbnail } from '@src/components'

  import Feedback from './Feedback.svelte'
  export let items = []
  export let feedbacks = []

  function computeLabel(player, { size }) {
    return player?.username ?? size
  }

  function computeFeedback({ action }) {
    return action === 'push'
      ? 'layers'
      : action === 'pop'
      ? 'layers_clear'
      : action === 'snap'
      ? 'link'
      : action === 'unsnap'
      ? 'link_off'
      : action === 'lock'
      ? 'lock'
      : action === 'unlock'
      ? 'lock_open'
      : ''
  }
</script>

{#each items as { screenPosition, id, mesh, player, onClick, hovered, ...rest } ({ id, screenPosition })}
  {#if mesh}
    <Label
      {screenPosition}
      {onClick}
      {hovered}
      content={computeLabel(player, rest)}
      color={player?.color}
    />
  {:else}
    <PlayerThumbnail {screenPosition} {player} />
  {/if}
{/each}
{#each feedbacks as { screenPosition, id, player, ...rest } (id)}
  <Feedback
    {screenPosition}
    icon={computeFeedback(rest)}
    content={player?.username ?? ''}
    color={player?.color}
  />
{/each}
