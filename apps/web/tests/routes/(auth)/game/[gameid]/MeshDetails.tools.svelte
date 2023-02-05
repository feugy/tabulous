<script>
  import { Tool } from '@atelier-wb/svelte'
  import MeshDetails from '@src/routes/(auth)/game/[gameId]/MeshDetails.svelte'
</script>

<Tool
  component={MeshDetails}
  name="Routes/game/[gameId]/Mesh Details"
  events={['open', 'close']}
  props={{ mesh: { image: '/assets/images/hearts-12.1.svg' } }}
/>
