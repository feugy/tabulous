<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { GameHand } from '../../src/components'
</script>

<ToolBox
  component={GameHand}
  name="Components/Game Hand"
  props={{}}
  events={['resize']}
>
  <Tool name="Default" />
  <Tool
    name="With some meshes"
    props={{ meshes: [{ id: 'foo' }, { id: 'bar' }] }}
  />
  <Tool name="Highlighted" props={{ highlight: true }} />
</ToolBox>
