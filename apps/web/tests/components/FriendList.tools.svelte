<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { FriendList } from '@src/components'
  import avatar from '@tests/fixtures/avatar.png'
  import { players as playerWithColors } from '@tests/fixtures/Discussion.testdata'

  const currentPlayer = {
    id: '135790',
    username: 'Fernande',
    usernameSearchable: true
  }
  const players = playerWithColors.map(player => ({
    ...player,
    color: undefined
  }))
  const playerById = new Map(
    playerWithColors.slice(0, 3).map(player => [player.id, player])
  )
  playerById.get(playerWithColors[0].id).isOwner = true
  playerById.get(playerWithColors[1].id).isGuest = true
  const friendsWithRequests = [
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
    { player: players[2] },
    { player: players[3] }
  ]
</script>

<ToolBox
  component={FriendList}
  name="Components/Friend List"
  events={['toggleSearchability']}
>
  <Tool
    name="Empty list"
    props={{
      currentPlayer,
      friends: []
    }}
  />
  <Tool
    name="With friends"
    props={{ currentPlayer, friends: players.map(player => ({ player })) }}
  />
  <Tool
    name="With requests and proposals"
    props={{ currentPlayer, friends: friendsWithRequests }}
  />
  <Tool
    name="With lobby"
    props={{
      currentPlayer: { ...currentPlayer, usernameSearchable: false },
      game: { availableSeats: 5 },
      playerById,
      friends: friendsWithRequests
    }}
  />
  <Tool
    name="With game"
    props={{
      currentPlayer: { ...currentPlayer, usernameSearchable: false },
      game: { kind: 'klondike', availableSeats: 3 },
      playerById,
      friends: friendsWithRequests
    }}
  />
  <Tool
    name="With game with no seats"
    props={{
      currentPlayer: { ...currentPlayer, usernameSearchable: false },
      game: { kind: 'klondike' },
      playerById,
      friends: friendsWithRequests
    }}
  />
</ToolBox>
