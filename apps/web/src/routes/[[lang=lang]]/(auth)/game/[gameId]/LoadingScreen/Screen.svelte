<script>
  // @ts-check
  import { buttonIds } from '@src/3d/utils/actions'
  import { HelpButton1, HelpButton2, HelpButton3 } from '@src/components'
  import { fade } from 'svelte/transition'
  import { _ } from 'svelte-intl'

  import { default as Logo } from './babylon-logo.svg?component'
  import { default as Spinning } from './spinning.svg?component'

  /** @type {boolean} whether the loading screen is visible; */
  export let visible = false

  /** @type {Map<keyof import('@tabulous/types').ActionSpec, import('@tabulous/types').ActionName[]>} map of action names by a given button. */
  export let actionNamesByButton = new Map()

  $: button1Actions = actionNamesByButton?.get(buttonIds.button1)
  $: button2Actions = actionNamesByButton?.get(buttonIds.button2)

  function mapToLabels(
    /** @type {import('@tabulous/types').ActionName[]} */ actions
  ) {
    return actions.map(action => $_(`tooltips.${action}`)).join('<br/>')
  }
</script>

<!-- eslint-disable svelte/no-at-html-tags -->
{#if visible}
  <div transition:fade class="overlay">
    <span>
      <Logo width="160" height="185" />
      <Spinning width="300" height="300" />
    </span>
    <ul>
      {#if button1Actions?.length}
        <li>
          <HelpButton1 />
          <p>{@html mapToLabels(button1Actions)}</p>
        </li>
      {/if}
      {#if button2Actions?.length}
        <li>
          <HelpButton2 />
          <p>{@html mapToLabels(button2Actions)}</p>
        </li>
      {/if}
      <li>
        <HelpButton3 />
        <p>{$_('tooltips.open-menu')}</p>
      </li>
    </ul>
  </div>
{/if}

<style lang="postcss">
  div {
    @apply flex-1 flex flex-col items-center overflow-hidden justify-center bg-$base-darkest text-$ink-dark transition-colors;
  }

  span {
    @apply grid items-center justify-items-center;
    > :global(*) {
      @apply row-start-1 col-start-1;
    }
    > :global(:nth-child(2)) {
      animation: spin 1s infinite linear;
    }
  }

  ul {
    @apply grid grid-flow-col gap-28 w-3/4;
  }

  li {
    @apply flex flex-col gap-4 items-center text-center;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
