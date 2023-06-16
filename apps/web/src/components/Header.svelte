<script>
  import { logOut } from '@src/stores'
  import Logo from '@src/svg/tabulous-logo.svg'
  import { _ } from 'svelte-intl'

  import { goto } from '$app/navigation'
  import { page } from '$app/stores'

  import Button from './Button.svelte'
  import Dropdown from './Dropdown.svelte'
  import PlayerThumbnail from './PlayerThumbnail.svelte'

  export let user = null

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

  function handleClickLogo() {
    goto('/')
  }
</script>

<header>
  <nav>
    <button on:click={handleClickLogo}><Logo /></button>
    <div>
      <slot />
    </div>
    <span class="nav">
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
      {:else if $page.route.id !== '/login'}
        <Button icon="account_circle" primary on:click={() => goto('/login')} />
      {/if}
    </span>
  </nav>
  <div />
</header>

<style lang="postcss">
  header {
    @apply w-full py-2 px-4  bg-$base-light sticky top-0 z-20 opacity-90 border-b border-$secondary-dark;

    :global(h1) {
      font-size: 1.5rem;
    }
  }

  nav {
    @apply grid grid-cols-[3.5rem,1fr,auto] gap-6 items-center;

    button {
      :global(svg) {
        @apply h-full w-full;
      }
    }

    .nav {
      @apply flex gap-8 items-center;
    }
  }
</style>
