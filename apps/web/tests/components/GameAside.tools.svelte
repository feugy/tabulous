<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import GameAside from './GameAsideWithVideo.svelte'
  import { thread, players } from './Discussion.testdata'

  const connected = [{ playerId: players[0].id }, { playerId: players[2].id }]
  const playerById = new Map(players.map(player => [player.id, player]))
  const singlePlayerById = new Map([[players[0].id, players[0]]])
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
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: singlePlayerById
    }}
  />
  <Tool
    name="Single connected"
    props={{
      player: players[0],
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById
    }}
  />
  <Tool
    name="Multiple connected"
    props={{
      player: players[0],
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById,
      connected
    }}
  />
  <Tool
    name="No peers, no rules book"
    props={{ player: players[0], playerById: singlePlayerById }}
  />
  <Tool
    name="Single connected, no rules book, thread"
    props={{ player: players[0], playerById, thread }}
  />
</ToolBox>
