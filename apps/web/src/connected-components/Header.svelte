<script>
  import { Button } from '../components'
  import { logOut } from '../stores'
</script>

<header>
  <nav>
    <Button icon="directions_run" secondary on:click={logOut} />
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
