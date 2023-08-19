<script>
  // ts-check
  import { RightObject, TwoPointersObject } from '@src/svg/help'
  import { isTouchScreen } from '@src/utils'
</script>

{#if isTouchScreen()}<TwoPointersObject />{:else} <RightObject />{/if}
