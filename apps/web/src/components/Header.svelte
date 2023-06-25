<script>
  import { logOut } from '@src/stores'
  import Logo from '@src/svg/tabulous-logo.svg?component'
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
    <span class="account">
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
    @apply w-full py-2 px-4 bg-$base-darker text-$ink-dark sticky top-0 z-20 opacity-90 border-b;
    box-shadow: 0px 3px 10px var(--shadow-color);

    :global(h1) {
      text-shadow: 0px 3px 0 var(--primary-darker);
      font-size: 1.5rem;
    }
  }

  nav {
    @apply grid grid-cols-[3.5rem,1fr,auto] gap-6 items-center;

    button {
      @apply relative text-$primary transform-gpu transition-all p-2 rounded-full;
      box-shadow: 0 3px var(--shadow-blur) var(--shadow-color),
        inset 0 2px var(--primary);

      &:hover,
      &:focus {
        @apply scale-110 text-$primary-light;
      }

      :global(svg) {
        @apply h-full w-full;
      }
    }

    .account {
      @apply pr-2;

      :global(button.transparent div) {
        @apply p-0;
      }
    }
  }
</style>
