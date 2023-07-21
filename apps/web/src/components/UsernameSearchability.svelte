<script>
  import { setUsernameSearchability } from '@src/stores'
  import { _ } from 'svelte-intl'
  
  import { invalidate } from '$app/navigation'

  export let searchable = false

  async function handleToggle() {
    await setUsernameSearchability(!searchable)
    invalidate('data:session')
  }
</script>

<span>
  <input
    id="toggle-searchability"
    type="checkbox"
    checked={searchable}
    on:change={handleToggle}
  />
  <label for="toggle-searchability"
    >{$_('labels.toggle-username-searchability')}</label
  >
</span>

<style lang="postcss">
  span {
    @apply my-2 flex gap-4 items-start;
  }

  input {
    @apply my-1;
  }

  label {
    @apply cursor-pointer;
  }
</style>
