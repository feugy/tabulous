<script>
  import { _, locale } from 'svelte-intl'

  import Button from './Button.svelte'
  const year = new Date().getFullYear()

  function scrollToTop() {
    location.hash = `#top`
  }
</script>

<footer>
  <section>© {year} {$_('labels.copyright')}</section>
  <span
    ><a href="/{$locale}/terms-of-service">{$_('labels.terms-of-service')}</a
    ></span
  >
  <span class="back-to-top">
    <Button icon="vertical_align_top" on:click={scrollToTop} />
  </span>
</footer>

<style lang="postcss">
  footer {
    @apply flex items-center mt-8 gap-8 py-4 px-1/8 <lg:px-0 <sm:flex-col <sm:gap-2;
    @apply bg-$base-lightest border-$base-dark border-t text-sm;
  }

  .back-to-top {
    @apply flex-1 text-right;
  }
</style>
