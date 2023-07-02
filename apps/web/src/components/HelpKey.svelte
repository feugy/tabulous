<script>
  import Skeleton from './Skeleton.svelte'

  export let key = ''
  export let height
  export let tone

  const iconPromise = import('@src/svg/help')
</script>

<span>
  {#await iconPromise}
    <Skeleton {height} {tone} />
  {:then { KeyStroke }}
    <KeyStroke />
    <strong>{key.toUpperCase()}</strong>
  {/await}
</span>

<style lang="postcss">
  span {
    @apply relative;
  }

  strong {
    @apply absolute top-1/2 left-1/2 transform-gpu -translate-x-1/2 -translate-y-1/2 pb-1 text-lg;
  }
</style>
