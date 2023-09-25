<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { Discussion } from '@src/components'
  import { history, players, thread } from '@tests/fixtures/Discussion.testdata'

  const time = 1694760291878
</script>

<ToolBox
  name="Components/Discussion"
  props={{
    replayRank: 0,
    playerById: new Map(players.map(player => [player.id, player])),
    history: [],
    currentPlayerId: players[2].id
  }}
  events={['sendMessage']}
  layout="centered"
>
  <Tool name="Long thread" props={{ thread }} let:props let:handleEvent>
    <div class="w-1/3 m-auto h-400px">
      <Discussion {...props} on:sendMessage={handleEvent} />
    </div>
  </Tool>

  <Tool
    name="short thread"
    props={{
      thread: [
        { playerId: '369258', text: 'Aww yeah!!', time },
        {
          playerId: '369258',
          text: 'Another one',
          time: time + 24 * 3600000
        }
      ]
    }}
    let:props
    let:handleEvent
  >
    <Discussion {...props} on:sendMessage={handleEvent} />
  </Tool>

  <Tool
    name="thread and history"
    props={{
      replayRank: 3,
      thread: [
        { playerId: '369258', text: 'Aww yeah!!', time: time + 1 },
        {
          playerId: '369258',
          text: 'Another one',
          time: time + 24 * 3600000
        }
      ],
      history
    }}
    let:props
    let:handleEvent
  >
    <Discussion {...props} on:sendMessage={handleEvent} />
  </Tool>
</ToolBox>
