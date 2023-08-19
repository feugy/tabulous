<script>
  // ts-check
  import { LongLeftObject, LongTwoPointersObject } from '@src/svg/help'
  import { isTouchScreen } from '@src/utils'
</script>

{#if isTouchScreen()}<LongTwoPointersObject />{:else} <LongLeftObject />{/if}
