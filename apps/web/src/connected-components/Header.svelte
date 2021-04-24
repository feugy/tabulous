<script>
  import { Button } from '../components'
  import { logOut } from '../stores'
</script>

<style type="postcss">
  header {
    @apply w-full;
    background: theme('colors.secondary.light');
  }

  div {
    @apply relative px-8 py-4 lg:w-3/4 lg:mx-auto;
  }
  nav {
    @apply flex justify-end lg:w-3/4 lg:mx-auto;
  }
</style>

<header>
  <nav>
    <Button icon="directions_run" secondary on:click={logOut} />
  </nav>
  <div>
    <slot />
  </div>
</header>
