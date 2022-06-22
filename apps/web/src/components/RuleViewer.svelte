<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import Button from './Button.svelte'

  export let page = 0
  export let lastPage = 0
  export let game = ''

  const dispatch = createEventDispatcher()

  function handleNavigate(previous = false) {
    page += previous ? -1 : 1
    dispatch('change', { page })
  }
</script>

<section>
  <menu>
    <Button
      icon="navigate_before"
      disabled={page === 0}
      on:click={() => handleNavigate(true)}
    />
    {page + 1}/{lastPage + 1}
    <Button
      icon="navigate_next"
      disabled={page > lastPage - 1}
      on:click={() => handleNavigate()}
    />
  </menu>
  <div class="image-container">
    {#if game}
      <img
        alt={$_('tooltips.rule-page', { page: page + 1 })}
        src={`games/${game}/rules/${page + 1}.webp`}
      />
    {/if}
  </div>
</section>

<style lang="postcss">
  section {
    @apply flex flex-col flex-1 max-h-full max-w-full items-center gap-2 p-2;
  }
  .image-container {
    @apply max-h-full overflow-hidden text-center;
  }
  img {
    @apply inline-block max-h-full;
  }
  menu {
    @apply flex gap-2 m-0 p-0 items-center;
  }
</style>
