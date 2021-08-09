<script>
  import { Tool } from '@atelier-wb/svelte'
  import Game from '../../src/routes/Game.svelte'
</script>

<Tool
  component={Game}
  name="Pages/Game"
  props={{ params: { gameId: '12345' } }}
/>
