<script>
  import { goto } from '$app/navigation'
  import { Button } from '../components'
  import { logOut } from '../stores'

  export let user
</script>

<header>
  <nav>
    {#if user}
      <Button icon="directions_run" secondary on:click={logOut} />
    {:else}
      <Button icon="login" secondary on:click={() => goto('/login')} />
    {/if}
  </nav>
  <div>
    <slot />
  </div>
</header>

<style lang="postcss">
  header {
    @apply w-full pt-4 px-4 bg-$secondary-light;
  }

  div {
    @apply relative lg:w-3/4 lg:mx-auto;
  }
  nav {
    @apply flex justify-end lg:w-3/4 lg:mx-auto;
  }
</style>
