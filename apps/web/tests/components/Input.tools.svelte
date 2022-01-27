<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { Input } from '../../src/components'
</script>

<ToolBox
  component={Input}
  name="Components/Input"
  events={['enter', 'input']}
  layout="centered"
>
  <Tool
    name="With initial value"
    props={{ placeholder: 'Please enter value', value: 'initial value' }}
  />
  <Tool name="No value" props={{ placeholder: 'Please enter value' }} />
</ToolBox>
