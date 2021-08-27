<script>
  import { MinimizableSection, Discussion } from '../../src/components'
  import { players, thread } from './Discussion.testdata'

  export let placement = 'top'
</script>

<style type="postcss">
  aside {
    @apply absolute bg-gray-100;

    &.left {
      @apply left-0;
    }
    &.top {
      @apply top-0;
    }
    &.right {
      @apply right-0;
    }
    &.bottom {
      @apply bottom-0;
    }
    &.left,
    &.right {
      @apply top-0 bottom-0;
      max-width: 50%;
    }
    &.top,
    &.bottom {
      @apply right-0 left-0;
    }
  }
</style>

<aside class={placement}>
  <MinimizableSection {...$$props} on:minimize on:resize>
    <Discussion {players} {thread} />
  </MinimizableSection>
</aside>
