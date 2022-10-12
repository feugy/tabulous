<script>
  import { goto } from '$app/navigation'
  import { _ } from 'svelte-intl'
  import { Button, Breadcrumb, Dropdown, PlayerThumbnail } from '../components'
  import { logOut } from '../stores'

  export let user
  export let breadcrumb

  const menu = [
    {
      icon: 'settings',
      label: $_('actions.go-to-account'),
      act: () => goto('/account')
    },
    { icon: 'directions_run', label: $_('actions.log-out'), act: logOut }
  ]

  function handleSelectMenuItem({ detail: item }) {
    item.act()
  }
</script>

<header>
  <nav>
    <span>
      <Breadcrumb steps={breadcrumb} />
    </span>
    {#if user}
      <Dropdown
        transparent
        valueAsText={false}
        withArrow={false}
        on:select={handleSelectMenuItem}
        options={menu}
      >
        <PlayerThumbnail slot="icon" player={user} dimension={30} />
      </Dropdown>
    {:else}
      <Button icon="account_circle" secondary on:click={() => goto('/login')} />
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
    @apply flex lg:w-3/4 lg:mx-auto items-center;

    > span {
      @apply flex-1;
    }
  }
</style>
