<script>
  import { Tool } from '@atelier-wb/svelte'
  import { RuleViewer } from '../../src/components'
</script>

<div class="rule-viewer">
  <Tool
    component={RuleViewer}
    name="Components/Rule Viewer"
    props={{ game: 'splendor', lastPage: 3 }}
    events={['change']}
    layout="centered"
    let:props
    let:handleEvent
  >
    <RuleViewer {...props} on:change={handleEvent} />
  </Tool>
</div>

<style lang="postcss">
  .rule-viewer {
    @apply flex overflow-hidden;
    width: 50vw;
    height: 100vh;

    :global(& .tool-preview) {
      @apply p-2;
    }

    :global(& .tool) {
      @apply w-full;
    }
  }
</style>
