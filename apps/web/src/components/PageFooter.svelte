<script>
  import { _ } from 'svelte-intl'
  const year = new Date().getFullYear()
</script>

<footer>
  <section>© {year} {$_('labels.copyright')}</section>
  <a href="/terms-of-service">{$_('labels.terms-of-service')}</a>
  <a href="#top" title={$_('actions.scroll-to-top')}
    ><i class="material-icons">vertical_align_top</i></a
  >
</footer>

<style lang="postcss">
  footer {
    @apply flex gap-8 py-8 px-1/8 <lg:px-0 <sm:flex-col <sm:gap-2;
    @apply bg-$primary-lighter border-$secondary-light border-t;

    & > * {
      @apply px-4;
    }

    & > :last-child {
      @apply flex-1 text-right;
    }
  }
</style>
