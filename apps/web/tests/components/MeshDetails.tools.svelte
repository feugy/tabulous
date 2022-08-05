<script>
  import { Tool } from '@atelier-wb/svelte'
  import { MeshDetails } from '../../src/components'
</script>

<Tool
  component={MeshDetails}
  name="Components/Mesh Details"
  events={['open', 'close']}
  props={{ mesh: { image: '/french-suited-card/images/hearts-12.svg' } }}
/>
