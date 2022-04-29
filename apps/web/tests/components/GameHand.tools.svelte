<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { GameHand } from '../../src/components'
</script>

<ToolBox
  component={GameHand}
  name="Components/Game Hand"
  props={{ visible: undefined, highlight: undefined, meshes: undefined }}
  events={['resize']}
>
  <Tool name="Default (not visible)" />
  <Tool
    name="With some meshes"
    props={{ visible: true, meshes: [{ id: 'foo' }, { id: 'bar' }] }}
  />
  <Tool name="Highlighted" props={{ visible: true, highlight: true }} />
</ToolBox>
