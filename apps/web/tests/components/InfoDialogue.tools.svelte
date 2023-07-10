<script>
  import { Tool } from '@atelier-wb/svelte'
  import { InfoDialogue } from '@src/components'
</script>

<Tool
  name="Components/Info Dialogue"
  props={{
    open: true,
    title: 'Maitre Folage',
    message: "C'est curieux chez les marins ce besoin de faire des phrases."
  }}
  let:props
  let:handleEvent
>
  <InfoDialogue {...props} on:close={handleEvent} on:open={handleEvent} />
</Tool>
