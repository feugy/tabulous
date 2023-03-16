<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { FriendList } from '@src/components'
  import avatar from '@tests/fixtures/avatar.png'
  import { players as playerWithColors } from '@tests/fixtures/Discussion.testdata'

  const players = playerWithColors.map(player => ({
    ...player,
    color: undefined
  }))
  const playerById = new Map(
    playerWithColors.slice(0, 2).map(player => [player.id, player])
  )
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
    { player: players[2] }
  ]
</script>

<ToolBox component={FriendList} name="Components/Friend List">
  <Tool
    name="Empty list"
    props={{
      friends: []
    }}
  />
  <Tool
    name="With friends"
    props={{ friends: players.map(player => ({ player })) }}
  />
  <Tool
    name="With requests and proposals"
    props={{ friends: friendsWithRequests }}
  />
  <Tool
    name="With game"
    props={{
      game: {},
      playerById,
      friends: friendsWithRequests
    }}
  />
</ToolBox>
