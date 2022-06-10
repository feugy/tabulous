<script>
  import Feedback from './Feedback.svelte'
  import Label from './Label.svelte'
  import PeerPointer from './PeerPointer.svelte'
  export let items = []

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

{#each items as { screenPosition, id, mesh, player, isFeedback, ...rest } (id)}
  {#if isFeedback}
    <Feedback
      {screenPosition}
      icon={computeFeedback(rest)}
      content={player?.username ?? ''}
    />
  {:else if mesh}
    <Label
      {screenPosition}
      centered={!!player}
      content={computeLabel(player, rest)}
    />
  {:else}
    <PeerPointer {screenPosition} {player} />
  {/if}
{/each}
