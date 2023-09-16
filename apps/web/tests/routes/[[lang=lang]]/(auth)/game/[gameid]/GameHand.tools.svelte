<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import GameHand from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/GameHand.svelte'
</script>

<ToolBox
  component={GameHand}
  name="Routes/game/[gameId]/Game Hand"
  props={{ visible: undefined, highlight: undefined, meshCount: 0 }}
  events={['resize']}
>
  <Tool name="Default (not visible)" />
  <Tool name="With some meshes" props={{ visible: true, meshCount: 2 }} />
  <Tool name="Highlighted" props={{ visible: true, highlight: true }} />
</ToolBox>
