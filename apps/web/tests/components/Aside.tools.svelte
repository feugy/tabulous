<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { actionNames, buttonIds } from '@src/3d/utils'
  import { acquireMediaStream, releaseMediaStream, stream$ } from '@src/stores'
  import avatar from '@tests/fixtures/avatar.png'
  import { players, thread } from '@tests/fixtures/Discussion.testdata'
  import { get } from 'svelte/store'
  import { _ } from 'svelte-intl'

  import Aside from './AsideWithVideo.svelte'

  let playerById = new Map(players.map(player => [player.id, player]))
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

  let stream

  function addPeer() {
    const id = `${Math.random()}`
    playerById = new Map([...playerById.entries(), [id, { ...players[0], id }]])
  }

  function removePeer() {
    playerById = new Map([...playerById.entries()].slice(0, -1))
  }
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
    friends,
    actionNamesByButton: new Map([
      [buttonIds.button1, [actionNames.flip]],
      [buttonIds.button2, [actionNames.detail]],
      [buttonIds.button3, [actionNames.rotate]]
    ]),
    actionNamesByKey: new Map([
      [$_('shortcuts.flip'), [actionNames.flip]],
      [$_('shortcuts.rotate'), [actionNames.rotate]],
      [$_('shortcuts.toggleLock'), [actionNames.toggleLock]],
      [$_('shortcuts.draw'), [actionNames.draw]],
      [$_('shortcuts.reorder'), [actionNames.reorder]],
      [$_('shortcuts.push'), [actionNames.push, actionNames.increment]],
      [$_('shortcuts.pop'), [actionNames.pop, actionNames.decrement]],
      [$_('shortcuts.random'), [actionNames.random]],
      [$_('shortcuts.setFace'), [actionNames.setFace]],
      [$_('shortcuts.detail'), [actionNames.detail]]
    ])
  }}
  events={['sendMessage']}
  setup={async () => {
    await acquireMediaStream()
  }}
  teardown={releaseMediaStream}
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
  <Tool
    name="Lobby"
    props={{ thread, game: {}, playerById: playingPlayersById }}
  />
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
      thread
    }}
    setup={({ props }) => {
      stream = get(stream$)
      return props
    }}
    let:props
    let:handleEvent
  >
    <Aside
      {...props}
      {playerById}
      withControls={true}
      connected={[...playerById.keys()].map(playerId => ({ playerId, stream }))}
      on:sendMessage={handleEvent}
      on:add={addPeer}
      on:remove={removePeer}
    />
  </Tool>
  <Tool
    name="No peers, no rules book"
    props={{ playerById: singlePlayerById }}
  />
  <Tool name="Single connected, no rules book, thread" props={{ thread }} />
</ToolBox>
