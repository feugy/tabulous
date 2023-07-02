<script>
  import { LongLeftObject, LongPointerObject } from '@src/svg/help'
  import { isTouchScreen } from '@src/utils'
</script>

{#if isTouchScreen()}<LongPointerObject />{:else} <LongLeftObject />{/if}
