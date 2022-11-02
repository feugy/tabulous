<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import ScrollableTerms from '../../../src/routes/accept-terms/ScrollableTerms.svelte'
</script>

<ToolBox
  name="Routes/accept-terms/Scrollable terms"
  layout="padded"
  events={['end']}
>
  <Tool name="Default" let:handleEvent>
    <div class="viewport">
      <ScrollableTerms on:end={handleEvent} />
    </div>
  </Tool>
</ToolBox>

<style lang="postcss">
  .viewport {
    @apply overflow-auto;
    max-height: 50vh;
  }
</style>
