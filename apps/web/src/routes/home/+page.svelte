<script>
  import { Aside, ConfirmDialogue, Header, PageFooter } from '@src/components'
  import {
    connected,
    createGame,
    currentGame,
    deleteGame,
    gamePlayerById,
    isDifferentGame,
    joinGame,
    leaveGame,
    listFriends,
    promoteGame,
    receiveGameListUpdates,
    sendToThread,
    thread,
    toastError,
    toastInfo
  } from '@src/stores'
  import { isLobby, translateError } from '@src/utils'
  import { readable } from 'svelte/store'
  import { _, locale } from 'svelte-intl'

  import { browser } from '$app/environment'
  import { beforeNavigate, goto } from '$app/navigation'
  import { page } from '$app/stores'

  import CatalogItem from './CatalogItem.svelte'
  import CreateLobby from './CreateLobby.svelte'
  import GameLink from './GameLink.svelte'

  /** @type {import('./$types').PageData} */
  export let data = {}

  let gameToDelete = null
  let user = null
  let games = readable(data.currentGames || [])
  let friends = readable([])
  $: isDeletedLobby = isLobby(gameToDelete)

  if (data.session?.player) {
    user = data.session.player
    games = receiveGameListUpdates(data.currentGames)
    friends = listFriends()
  }

  $: if (browser && $page.url.searchParams.get('game-name')) {
    $page.url.searchParams.delete('game-name')
    goto($page.url.toString())
  }

  $: if (data.creationError) {
    toastError({ content: translateError($_, data.creationError) })
  }

  beforeNavigate(({ to }) => {
    if (user && isDifferentGame(to?.params?.gameId)) {
      leaveGame(user)
    }
  })

  function handleSelectGame({ detail: game }) {
    if (isLobby(game)) {
      leaveGame(user)
      enterGame(game)
    } else {
      goto(`/game/${game.id}`)
    }
  }

  async function handleDeleteGame({ detail: game }) {
    gameToDelete = game
  }

  async function handleDeletionClose({ detail: confirmed } = {}) {
    if (confirmed) {
      await deleteGame(gameToDelete.id)
      toastInfo({
        contentKey: isDeletedLobby
          ? 'labels.lobby-deleted'
          : 'labels.game-deleted'
      })
    }
    gameToDelete = null
  }

  async function handleCreateGame({ detail: name }) {
    if ($currentGame) {
      const gameId = $currentGame.id
      await promoteGame(gameId, name)
    } else {
      let creationUrl = `/home?game-name=${encodeURIComponent(name)}`
      if (user) {
        goto(creationUrl)
      } else {
        goto(`login?redirect=${encodeURIComponent(creationUrl)}`)
      }
    }
  }

  async function handleCreateLobby() {
    await enterGame(await createGame())
  }

  function enterGame(game) {
    return joinGame({
      gameId: game.id,
      ...data.session,
      onPromotion: promoted => {
        handleSelectGame({ detail: promoted })
      }
    })
  }

  function handleCloseLobby() {
    leaveGame(user)
  }
</script>

<svelte:head>
  <title>{$_('page-titles.home')}</title>
</svelte:head>

<main>
  <Header {user}>
    <h1>
      {$_(user ? 'titles.home' : 'titles.welcome', user)}
    </h1>
  </Header>
  <div class="grid">
    <div class="scrollable">
      <i id="top" />
      <span class="padded">
        {#if user}
          <h2>{$_('titles.your-games')}</h2>
          <section aria-roledescription="games">
            {#each $games.sort((a, b) => b.created - a.created) as game (game.id)}
              <GameLink
                {game}
                playerId={user.id}
                isCurrent={game.id === $currentGame?.id}
                on:select={handleSelectGame}
                on:delete={handleDeleteGame}
                on:close={handleCloseLobby}
              />
            {:else}
              <span class="no-games">{$_('labels.no-games-yet')}</span>
            {/each}
          </section>
        {/if}

        <h2>{$_('titles.catalog')}</h2>
        <section aria-roledescription="catalog">
          {#if user}
            <CreateLobby on:select={handleCreateLobby} />
          {/if}
          {#each data.catalog as game}
            <CatalogItem {game} on:select={handleCreateGame} />
          {/each}
        </section>
      </span>
      <PageFooter />
    </div>
    {#if user}
      <Aside
        game={$currentGame}
        player={user}
        playerById={$gamePlayerById}
        connected={$connected}
        thread={$thread}
        friends={$friends}
        on:sendMessage={({ detail }) => sendToThread(detail.text)}
      />
    {/if}
  </div>
</main>

{#if gameToDelete}
  <ConfirmDialogue
    open
    title={$_(
      isDeletedLobby
        ? 'titles.confirm-lobby-deletion'
        : 'titles.confirm-game-deletion'
    )}
    message={$_(
      isDeletedLobby
        ? 'labels.confirm-lobby-deletion'
        : 'labels.confirm-game-deletion',
      gameToDelete.locales?.[$locale]
    )}
    on:close={handleDeletionClose}
  />
{/if}

<style lang="postcss">
  main {
    @apply flex flex-col max-h-screen;
  }

  .grid {
    @apply grid grid-cols-[1fr,auto] grid-rows-[100%] flex-1 overflow-hidden;
  }

  .scrollable {
    @apply flex flex-col overflow-y-auto;
    background: var(--page-bg);
  }

  .padded {
    @apply px-6 flex-1;
  }

  h2 {
    @apply mx-auto w-full max-w-screen-2xl border-b-2 border-$base;
  }

  section {
    @apply grid my-6 gap-6 justify-center mx-auto max-w-screen-2xl;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }

  .no-games {
    @apply italic;
  }
</style>
