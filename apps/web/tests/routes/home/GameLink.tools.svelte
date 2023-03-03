<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import GameLink from '@src/routes/home/GameLink.svelte'

  const players = [
    {
      id: '170ec20e-5dfe-407b-acb4-13ae0eb1a40a',
      username: 'Chandra',
      isGuest: false,
      isOwner: true
    },
    {
      id: '485d5a8d-5a6b-4fa9-b54c-2020bab66368',
      username: 'Sarah',
      isGuest: false,
      isOwner: false
    },
    {
      id: 'dfd83db5-978d-42e3-bf5c-8922f387ea59',
      username: 'Timothé',
      isGuest: false,
      isOwner: false
    },
    {
      id: 'e02ce071-5dfe-407b-acb4-13ae0eb1aa04',
      username: 'John',
      isGuest: true,
      isOwner: false
    },
    {
      id: 'd8a5d584-5a6b-4fa9-b54c-2020bab66863',
      username: 'Georges',
      isGuest: true,
      isOwner: false
    }
  ]
  const game = {
    id: 'fb236220-62a3-4c97-b938-716512386153',
    kind: 'riichi',
    locales: { fr: { title: 'Richii Mahjong' } },
    created: 1619983503676,
    players: []
  }

  const lobby = {
    id: 'fb236220-62a3-4c97-b938-716512386153',
    created: 1619983503676,
    players: []
  }
</script>

<ToolBox
  component={GameLink}
  name="Routes/home/Game Link"
  props={{
    playerId: players[0].id,
    game: {
      ...game,
      players
    }
  }}
  events={['select', 'close', 'delete']}
  layout="padded"
>
  <Tool name="Owned" />
  <Tool
    name="Single owned"
    props={{
      game: { ...game, players: players.slice(0, 1) }
    }}
  />
  <Tool name="Invited" props={{ playerId: players[1].id }} />
  <Tool
    name="Guests only"
    props={{
      game: { ...game, players: players.filter(({ isGuest }) => isGuest) }
    }}
  />
  <Tool name="Lobby" props={{ game: lobby }} />
  <Tool name="Current lobby" props={{ game: lobby, isCurrent: true }} />
</ToolBox>
