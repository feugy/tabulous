<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import GameAside from './GameAsideWithVideo.svelte'
  import { thread, players } from './Discussion.testdata'

  const connected = [{ playerId: players[0].id }, { playerId: players[2].id }]
  const playerById = new Map(players.map(player => [player.id, player]))
  const playingPlayersById = new Map(
    players.map(player => [player.id, { ...player, playing: true }])
  )
  const singlePlayerById = new Map([[players[0].id, players[0]]])
</script>

<ToolBox
  component={GameAside}
  name="Components/Game Aside"
  props={{ player: players[0], playerById, connected: [], thread: [] }}
  events={['sendMessage']}
>
  <Tool
    name="No peers"
    props={{
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: singlePlayerById
    }}
  />
  <Tool
    name="Single connected"
    props={{
      game: { kind: 'splendor', rulesBookPageCount: 4 }
    }}
  />
  <Tool
    name="Multiple connected"
    props={{
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: playingPlayersById,
      connected,
      thread
    }}
  />
  <Tool
    name="No peers, no rules book"
    props={{ playerById: singlePlayerById }}
  />
  <Tool name="Single connected, no rules book, thread" props={{ thread }} />
</ToolBox>
