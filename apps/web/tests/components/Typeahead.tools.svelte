<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'

  import Typeahead from './Typeahead.svelte'
</script>

<ToolBox
  component={Typeahead}
  name="Components/Typeahead"
  events={['change', 'input', 'close', 'select']}
  layout="centered"
>
  <Tool name="With labels" />
  <Tool name="With objects" />
</ToolBox>
