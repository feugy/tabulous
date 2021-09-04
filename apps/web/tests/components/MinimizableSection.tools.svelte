<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import MinimizableSection from './MinizableSection.svelte'
</script>

<ToolBox
  component={MinimizableSection}
  name="Components/Minimizable Section"
  events={['minimize', 'resize', 'change']}
>
  <Tool
    name="Multiple, custom tabs"
    props={{
      placement: 'bottom',
      minimized: true,
      icons: ['question_answer', 'help']
    }}
  />
  <Tool name="Left" props={{ placement: 'left' }} />
  <Tool name="Right" props={{ placement: 'right' }} />
  <Tool name="Top" props={{ placement: 'top' }} />
  <Tool name="Bottom" props={{ placement: 'bottom' }} />
</ToolBox>
