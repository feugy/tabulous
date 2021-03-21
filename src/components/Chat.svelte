<script>
  import { chat, connectedPeers, sendToPeers } from '../stores'

  let outgoingMessage

  function handleSend() {
    sendToPeers({ message: outgoingMessage })
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
    height: 30%;
    display: flex;
    flex-direction: column;
  }
  ul {
    flex-grow: 1;
    overflow-y: auto;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li {
    padding-bottom: 0.5em;
  }
  .from {
    font-weight: 450;
    color: lightslategray;
    padding-right: 0.5em;
  }
</style>

{#if $connectedPeers.length}
  <aside>
    <ul>
      {#each $chat || [] as { peer, message }}<li>
          <span class="from">{peer}</span><span class="message">{message}</span>
        </li>{/each}
    </ul>
    <form on:submit|preventDefault={handleSend}>
      <input bind:value={outgoingMessage} />
      <button type="submit">Envoyer</button>
    </form>
  </aside>
{/if}
