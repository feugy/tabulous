<script>
  import { Tool } from '@atelier-wb/svelte'
  import { MeshDetails } from '../../src/components'
  import image from './avatar.png'
</script>

<Tool
  component={MeshDetails}
  name="Components/Mesh Details"
  events={['open', 'close']}
  props={{ mesh: { image } }}
/>
