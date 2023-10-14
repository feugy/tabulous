<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import Scores from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/Scores.svelte'
  import { players } from '@tests/fixtures/Discussion.testdata'

  const playerById = new Map(players.map(player => [player.id, player]))
</script>

<ToolBox
  component={Scores}
  name="Routes/game/[gameId]/Scores"
  props={{ playerById, scores: null }}
  events={['resize']}
>
  <Tool name="No score (not visible)" />
  <Tool
    name="With score"
    props={{
      scores: {
        [players[0].id]: { total: 10 },
        [players[1].id]: { total: 8 },
        [players[2].id]: { total: 12 }
      }
    }}
  />
</ToolBox>
