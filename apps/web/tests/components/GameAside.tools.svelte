<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import GameAside from './GameAsideWithVideo.svelte'
  import { thread, players } from './Discussion.testdata'

  const connected = [{ playerId: players[0].id }, { playerId: players[2].id }]
</script>

<ToolBox
  component={GameAside}
  name="Components/Game Aside"
  props={{}}
  events={['sendToThread']}
>
  <Tool
    name="No peers"
    props={{
      player: players[0],
      game: {
        kind: 'splendor',
        rulesBookPageCount: 4,
        players: players.slice(0, 1)
      }
    }}
  />
  <Tool
    name="Single connected"
    props={{
      player: players[0],
      game: { kind: 'splendor', rulesBookPageCount: 4, players }
    }}
  />
  <Tool
    name="Multiple connected"
    props={{
      player: players[0],
      game: { kind: 'splendor', rulesBookPageCount: 4, players },
      connected
    }}
  />
  <Tool
    name="No peers, no rules book"
    props={{ player: players[0], game: { players: players.slice(0, 1) } }}
  />
  <Tool
    name="Single connected, no rules book, thread"
    props={{ player: players[0], game: { players }, thread }}
  />
</ToolBox>
