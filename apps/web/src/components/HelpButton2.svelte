<script>
  // ts-check
  import { DoubleLeftObject, DoublePointerObject } from '@src/svg/help'
  import { isTouchScreen } from '@src/utils'
</script>

{#if isTouchScreen()}<DoublePointerObject />{:else} <DoubleLeftObject />{/if}
