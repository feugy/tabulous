<script>
  import { _ } from 'svelte-intl'
  export let actions = []
  export let outcome = ''
</script>

<div>
  <span>{$_(`tooltips.${outcome}`)}: </span>
  {#each actions as action}
    <img
      alt={$_(`tooltips.help-${action}`)}
      src={`/images/help/${action}.webp`}
    />
  {/each}
</div>

<style lang="postcss">
  div {
    @apply inline-flex items-center;
  }

  img {
    width: 30%;

    &:not(:first-of-type) {
      @apply ml-1;
    }

    &:not(:last-of-type) {
      @apply border-r border-$secondary-light pr-1;
    }
  }

  span {
    @apply flex-1 pl-2;
  }
</style>
