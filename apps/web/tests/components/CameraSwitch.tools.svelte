<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { CameraSwitch } from '../../src/components'
</script>

<ToolBox
  component={CameraSwitch}
  name="Components/Camera Switch"
  events={['save', 'restore']}
>
  <Tool name="Single save" props={{ saveCount: 1 }} />
  <Tool name="Multiple saves" props={{ saveCount: 3 }} />
  <Tool name="Max count reached" props={{ saveCount: 4, maxCount: 4 }} />
</ToolBox>
