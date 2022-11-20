<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import NewGamePage from '@src/routes/(auth)/game/new/+page.svelte'
  import { setSvelteUrl } from '@tests/atelier/setup'
</script>

<ToolBox
  component={NewGamePage}
  name="Routes/game/new"
  setup={() => setSvelteUrl('game/new?name=klondike')}
>
  <Tool name="Error" />
</ToolBox>
