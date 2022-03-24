<script>
  import { Tool } from '@atelier-wb/svelte'
  import { RuleViewer } from '../../src/components'
</script>

<style lang="postcss">
  .rule-viewer {
    @apply flex h-full overflow-auto;
    max-width: 100vh;

    :global(& .tool-preview) {
      @apply overflow-auto p-2;
    }
  }
</style>

<div class="rule-viewer">
  <Tool
    component={RuleViewer}
    name="Components/Rule Viewer"
    props={{ game: 'klondike', lastPage: 3 }}
    events={['change']}
    layout="centered"
  />
</div>
