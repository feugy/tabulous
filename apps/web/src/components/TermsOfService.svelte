<script>
  // @ts-check
  import { _ } from 'svelte-intl'

  import Markdown from './Markdown.svelte'

  /** @type {boolean} whether to show the page title. */
  export let withTitle = true
</script>

<Markdown
  titleKey={withTitle ? 'titles.terms-of-service' : undefined}
  contentKey="markdown.terms-of-service"
/>
<div>
  {$_('labels.last-updated', {
    published: new Date('2022-11-01T00:00:00.000Z')
  })}
</div>

<style lang="postcss">
  div {
    @apply pt-16;
  }
</style>
