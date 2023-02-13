<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import avatar from '@tests/fixtures/avatar.png'
  import { players, thread } from '@tests/fixtures/Discussion.testdata'

  import Aside from './AsideWithVideo.svelte'

  const connected = [{ playerId: players[0].id }, { playerId: players[2].id }]
  const playerById = new Map(players.map(player => [player.id, player]))
  const playingPlayersById = new Map(
    players.map(player => [player.id, { ...player, playing: true }])
  )
  const singlePlayerById = new Map([[players[0].id, players[0]]])
  const friends = [
    { player: players[0] },
    {
      player: { id: '425364', username: 'Paul Wolfoni', avatar },
      isRequest: true
    },
    {
      player: {
        id: '758697',
        username: 'Raoul Wolfoni',
        color: '#040404'
      },
      isProposal: true
    },
    { player: players[1] },
    { player: players[2] }
  ].map(friend => ({
    ...friend,
    player: { ...friend.player, color: undefined }
  }))
</script>

<ToolBox
  component={Aside}
  name="Components/Aside"
  props={{
    game: { kind: 'splendor' },
    player: players[0],
    playerById,
    connected: [],
    thread: [],
    friends
  }}
  events={['sendMessage']}
>
  <Tool
    name="Friends only"
    props={{
      game: undefined,
      playerById: undefined,
      connected: undefined,
      thread: undefined
    }}
  />
  <Tool name="Lobby" props={{ thread, game: {} }} />
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
