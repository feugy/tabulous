<script>
  import { ToolBox, Tool } from '@atelier-wb/svelte'
  import Typeahead from './Typeahead.svelte'
</script>

<ToolBox
  component={Typeahead}
  name="Components/Typeahead"
  events={['change', 'input', 'close', 'select']}
>
  <Tool name="With labels" />
  <Tool name="With objects" />
</ToolBox>
