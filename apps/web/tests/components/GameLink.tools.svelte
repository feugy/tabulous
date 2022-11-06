<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'

  import { GameLink } from '../../src/components'
  const players = [
    { id: '170ec20e-5dfe-407b-acb4-13ae0eb1a40a', username: 'Chandra' },
    { id: '485d5a8d-5a6b-4fa9-b54c-2020bab66368', username: 'Sarah' },
    { id: 'dfd83db5-978d-42e3-bf5c-8922f387ea59', username: 'Timothé' }
  ]
  const game = {
    id: 'fb236220-62a3-4c97-b938-716512386153',
    kind: 'riichi',
    locales: { fr: { title: 'Richii Mahjong' } },
    created: 1619983503676
  }
</script>

<ToolBox
  component={GameLink}
  name="Components/Game Link"
  props={{
    game: {
      ...game,
      players
    }
  }}
  events={['delete']}
  layout="centered"
>
  <Tool name="Owned" props={{ playerId: players[0].id }} />
  <Tool
    name="Single owned"
    props={{
      game: { ...game, players: players.slice(0, 1) },
      playerId: players[0].id
    }}
  />
  <Tool name="Invited" props={{ playerId: players[1].id }} />
</ToolBox>
