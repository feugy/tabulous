<script>
  import { ToolBox, Tool } from '@atelier-wb/svelte'
  import { CatalogItem } from '../../src/components'
</script>

<style type="postcss">
  .catalog-item-viewer {
    :global(& .tool-preview) {
      @apply grid gap-6 p-6;
      grid-auto-columns: minmax(75px, 300px);
    }
  }
</style>

<span class="catalog-item-viewer">
  <ToolBox
    component={CatalogItem}
    name="Components/Catalog Item"
    events={['click']}
  >
    <Tool name="No age nor time" props={{ game: { name: 'klondike' } }} />
    <Tool
      name="With Age and time"
      props={{
        game: { name: 'splendor', minTime: 30, minAge: 10, restricted: true }
      }}
    />
  </ToolBox>
</span>
