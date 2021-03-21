<script>
  import { connectToPeer, connectedPeers, currentPeerId } from '../stores'

  let id

  function handleConnect() {
    connectToPeer(id)
  }
</script>

<style>
  aside {
    position: absolute;
    top: 5px;
    left: 5px;
    z-index: 1;
    background-color: white;
    padding: 0.5rem;
  }
</style>

{#if $connectedPeers.length === 0}
  <aside>
    <div>Peer id: {$currentPeerId}</div>
    <form on:submit|preventDefault={handleConnect}>
      <input bind:value={id} />
      <button type="submit">Rejoindre</button>
    </form>
  </aside>
{/if}
