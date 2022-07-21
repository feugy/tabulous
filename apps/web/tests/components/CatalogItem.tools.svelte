<script>
  import { ToolBox, Tool } from '@atelier-wb/svelte'
  import { CatalogItem } from '../../src/components'

  const locales = { fr: { title: 'Solitaire' } }
</script>

<ToolBox name="Components/Catalog Item" layout="centered">
  <Tool
    name="No age nor time"
    props={{ game: { name: 'klondike', locales } }}
    let:props
    let:handleEvent
  >
    <span class="catalog-item-viewer">
      <CatalogItem {...props} on:click={handleEvent} />
    </span>
  </Tool>

  <Tool
    name="With characteristics"
    props={{
      game: {
        name: 'klondike',
        locales,
        minTime: 30,
        minAge: 10,
        minSeats: 2,
        maxSeats: 2
      }
    }}
    let:props
    let:handleEvent
  >
    <span class="catalog-item-viewer">
      <CatalogItem {...props} on:click={handleEvent} />
    </span>
  </Tool>

  <Tool
    name="With characteristics and copyright"
    props={{
      game: {
        name: 'klondike',
        locales,
        minTime: 30,
        minAge: 10,
        minSeats: 2,
        maxSeats: 4,
        copyright: {
          authors: [{ name: 'John Doe' }, { name: 'Jane Lark' }],
          designers: [{ name: 'Amy Banks' }, { name: 'Mark Loom' }],
          publishers: [
            { name: 'Awesome games' },
            { name: 'Games from elsewhere' }
          ]
        }
      }
    }}
    let:props
    let:handleEvent
  >
    <span class="catalog-item-viewer">
      <CatalogItem {...props} on:click={handleEvent} />
    </span>
  </Tool>
</ToolBox>

<style lang="postcss">
  .catalog-item-viewer {
    :global(& .tool-preview) {
      @apply grid gap-6 p-6;
      grid-auto-columns: minmax(75px, 300px);
    }
  }
</style>
