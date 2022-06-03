<script>
  import Label from './Label.svelte'
  import PeerPointer from './PeerPointer.svelte'
  export let items = []
</script>

{#each items as { screenPosition, id, mesh, player, size } (id)}
  {#if mesh}
    <Label
      {screenPosition}
      centered={!!player}
      content={player?.username ?? size}
    />
  {:else}
    <PeerPointer {screenPosition} {player} />
  {/if}
{/each}
