<script>
  import { _ } from 'svelte-intl'
  import SvelteMarkdown from 'svelte-markdown'

  export let options = {}
  export let titleKey
  export let contentKey
</script>

<section>
  {#if titleKey}<h2>{$_(titleKey)}</h2>{/if}
  <SvelteMarkdown source={$_(contentKey)} {options} />
</section>

<style lang="postcss">
  section {
    @apply inline-block;

    :global(p) {
      @apply my-2 leading-relaxed text-justify;
    }

    :global(ul) {
      @apply list-square my-2;
    }

    :global(li) {
      @apply ml-6 mb-2;
    }

    :global(h2) {
      @apply px-4 py-2 mt-4 mb-2 border-b-2 bg-$base-lighter;
    }

    :global(h3) {
      @apply px-4 py-2 mt-4 mb-2 border-b-2 border-$base;
    }

    :global(h4) {
      @apply py-2 mx-8 mt-4 mb-2;
    }
  }
</style>
