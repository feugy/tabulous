<script>
  import { Tool } from '@atelier-wb/svelte'
  import Game from '../../src/routes/Game.svelte'
</script>

<Tool name="Pages/Game" props={{ params: { gameId: '12345' } }} let:props>
  <span class="overflow-hidden flex-1">
    <Game {...props} />
  </span>
</Tool>
