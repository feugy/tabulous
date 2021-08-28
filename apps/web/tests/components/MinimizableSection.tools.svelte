<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import MinimizableSection from './MinizableSection.svelte'
</script>

<ToolBox
  component={MinimizableSection}
  name="Components/Minimizable Section"
  events={['minimize', 'resize']}
>
  <Tool
    name="Custom icon"
    props={{ placement: 'bottom', icon: 'question_answer' }}
  />
  <Tool name="Left" props={{ placement: 'left' }} />
  <Tool name="Right" props={{ placement: 'right' }} />
  <Tool name="Top" props={{ placement: 'top' }} />
  <Tool name="Bottom" props={{ placement: 'bottom' }} />
</ToolBox>
