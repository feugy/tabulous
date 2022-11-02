<script>
  import { _ } from 'svelte-intl'
  import SvelteMarkdown from 'svelte-markdown'

  export let options = {}
  export let titleKey
  export let contentKey
</script>

<section>
  {#if titleKey}<h1>{$_(titleKey)}</h1>{/if}
  <SvelteMarkdown source={$_(contentKey)} {options} />
</section>

<style lang="postcss">
  section {
    @apply inline-block;

    h1 {
      @apply text-3xl underline underline-$primary-light mt-8 mb-6;
    }

    :global(p) {
      @apply my-2 leading-relaxed text-justify;
    }

    :global(ul) {
      @apply list-square my-2;
    }

    :global(li) {
      @apply ml-6 mb-2;
    }

    :global(h2),
    :global(h3) {
      @apply text-xl underline underline-$primary-light mt-6 mb-4;
    }

    :global(h3) {
      @apply mx-4 text-base;
    }
  }
</style>
