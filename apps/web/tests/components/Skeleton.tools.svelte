<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { Skeleton } from '@src/components'
</script>

<ToolBox
  layout="padded"
  component={Skeleton}
  name="Components/Skeleton"
  props={{ tone: 'base-dark' }}
>
  <Tool name="Square" props={{ width: '50px', height: '50px' }} />
  <Tool name="Rectangle" props={{ width: '200px', height: '25px' }} />
</ToolBox>
