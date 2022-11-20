<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import Discussion from '@src/routes/(auth)/game/[gameId]/Discussion.svelte'
  import { players, thread } from '@tests/fixtures/Discussion.testdata'
</script>

<ToolBox
  name="Routes/game/[gameId]/Discussion"
  props={{ playerById: new Map(players.map(player => [player.id, player])) }}
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
      thread: [{ playerId: '369258', text: 'Aww yeah!!' }]
    }}
    let:props
    let:handleEvent
  >
    <Discussion {...props} on:sendMessage={handleEvent} />
  </Tool>
</ToolBox>
