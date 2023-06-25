<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'

  import MinimizableSection from './MinimizableSection.svelte'
</script>

<ToolBox
  component={MinimizableSection}
  name="Components/Minimizable Section"
  events={['minimize', 'resize', 'change']}
>
  <Tool
    name="Multiple horizontal, custom tabs"
    props={{
      placement: 'bottom',
      minimized: true,
      tabs: [{ icon: 'question_answer' }, { icon: 'help' }]
    }}
  />
  <Tool
    name="Multiple vertical, custom tabs"
    props={{
      placement: 'right',
      tabs: [{ icon: 'question_answer' }, { icon: 'help' }]
    }}
  />
  <Tool name="Left" props={{ placement: 'left' }} />
  <Tool name="Right" props={{ placement: 'right' }} />
  <Tool name="Top" props={{ placement: 'top' }} />
  <Tool name="Bottom" props={{ placement: 'bottom' }} />
</ToolBox>
