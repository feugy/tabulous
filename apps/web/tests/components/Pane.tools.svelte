<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { Pane } from '@src/components'
</script>

<ToolBox
  component={Pane}
  name="Components/Pane"
  props={{ title: undefined }}
  layout="padded"
>
  <Tool name="No Title" />
  <Tool name="With Title" props={{ title: 'Hello world!' }} />
</ToolBox>
