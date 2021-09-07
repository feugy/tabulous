<script>
  import { Tool } from '@atelier-wb/svelte'
  import { RuleViewer } from '../../src/components'
</script>

<style type="postcss">
  .rule-viewer {
    @apply flex -mt-16 max-h-full;

    :global(& .tool-preview) {
      @apply overflow-auto p-2;
    }
  }
</style>

<div class="rule-viewer">
  <Tool
    component={RuleViewer}
    name="Components/Rule Viewer"
    props={{ game: 'splendor', lastPage: 3 }}
    events={['change']}
  />
</div>
