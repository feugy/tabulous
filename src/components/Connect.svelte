<script>
  import { connectWith, connected, currentPeerId } from '../stores'

  let id
</script>

<style type="postcss">
  aside {
    @apply absolute z-10 bg-white;
    top: 5px;
    left: 5px;
    padding: 0.5rem;
  }
</style>

{#if $connected.length === 0}
  <aside>
    <div>Peer id: {$currentPeerId}</div>
    <form on:submit|preventDefault={() => connectWith(id)}>
      <input bind:value={id} />
      <button type="submit">Rejoindre</button>
    </form>
  </aside>
{/if}
