<script>
  // ts-check
  import { LeftObject, PointerObject } from '@src/svg/help'
  import { isTouchScreen } from '@src/utils'
</script>

{#if isTouchScreen()}<PointerObject />{:else} <LeftObject />{/if}
