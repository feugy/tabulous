<script>
  import { Tool } from '@atelier-wb/svelte'
  import MeshDetails from '@src/routes/(auth)/game/[gameId]/MeshDetails.svelte'
</script>

<Tool
  component={MeshDetails}
  name="Routes/game/[gameId]/Mesh Details"
  events={['open', 'close']}
  props={{ mesh: { image: '/french-suited-card/images/hearts-12.svg' } }}
/>
