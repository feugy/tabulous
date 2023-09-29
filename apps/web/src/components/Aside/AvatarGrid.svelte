<script>
  // @ts-check
  import { getPixelDimension, observeDimension } from '@src/utils'
  import { onMount } from 'svelte'

  import PlayerAvatar from './PlayerAvatar.svelte'

  /** @type {import('@src/graphql').PlayerWithSearchable} authenticated player. */
  export let user
  /** @type {Map<string, import('@src/stores').PlayerWithPref>} map of game/lobby players by their ids. */
  export let playerById
  /** @type {import('@src/stores').Connected[]} currently connected active players. */
  export let connected

  let absoluteMin = 0.4
  let min = 1
  let max = 4 / 3

  /** @type {?HTMLDivElement} */
  let container
  let rows = 1
  let columns = 1

  $: otherPlayers = [...(playerById?.values() ?? [])].filter(
    ({ id }) => id !== user.id
  )

  $: hasPeers = playerById?.size > 1

  $: peers = hasPeers
    ? otherPlayers.map(player => ({
        player,
        ...(connected?.find(({ playerId }) => playerId === player.id) ?? {})
      }))
    : []

  $: avatarCount = peers.length + (connected?.length ? 1 : 0)

  $: if (connected && playerById && container) {
    resize(getPixelDimension(container))
  }

  onMount(() => {
    if (container) {
      const { dimension$, disconnect } = observeDimension(container, 0)
      dimension$.subscribe(resize)
      return () => disconnect()
    }
  })

  function resize(
    /** @type {import('@src/utils').Dimension} */ { width, height }
  ) {
    if (width && height) {
      rows = 0
      columns = 0
      let ratio = 0
      const dimensionPerDistance = new Map()
      while (rows < avatarCount) {
        rows++
        columns = Math.ceil(avatarCount / rows)
        ratio = width / columns / (height / rows)
        if (avatarCount !== (rows - 1) * columns) {
          if (ratio >= min && ratio <= max) {
            break
          }
          if (ratio >= absoluteMin && ratio > max) {
            dimensionPerDistance.set(ratio > max ? ratio - max : min - ratio, {
              columns,
              rows,
              ratio
            })
          }
        }
      }
      if (rows === avatarCount && dimensionPerDistance.size) {
        const [best] = [...dimensionPerDistance.keys()].sort()
        ;({ columns, rows, ratio } = dimensionPerDistance.get(best))
      }
    }
  }
</script>

<div bind:this={container} style="--rows:{rows};--columns:{columns}">
  <!-- eslint-disable-next-line no-unused-vars : we remove playerId since PlayerAvatar doesn't need it -->
  {#each peers as { playerId, ...props } (props.player.id)}
    <PlayerAvatar {...props} />
  {/each}
  {#if connected?.length}
    <PlayerAvatar player={playerById.get(user.id)} isLocal={true} />
  {/if}
</div>

<style lang="postcss">
  div {
    @apply relative flex-1 flex flex-wrap overflow-hidden items-center justify-center;

    :global(> *) {
      @apply flex-shrink flex-grow;
      width: calc(100% / var(--columns));
      height: calc(100% / var(--rows));
    }
  }
</style>
