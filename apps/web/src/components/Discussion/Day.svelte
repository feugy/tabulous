<script>
  // @ts-check
  import { _ } from 'svelte-intl'

  /** @type {number} time for that day. */
  export let time
</script>

<span>{$_('{ time, date, date-only }', { time })}</span>

<style lang="postcss">
  span {
    @apply grid grid-cols-[1fr,auto,1fr] text-$base-dark col-span-2 gap-4 items-center;

    &:before,
    &:after {
      @apply content-[''] border-$base-light border-t-1;
    }
  }
</style>
