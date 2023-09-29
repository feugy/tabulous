<script>
  // @ts-check
  import {
    Aside,
    ConfirmDialogue,
    Header,
    InfoDialogue,
    PageFooter
  } from '@src/components'
  import {
    comparator$,
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
  export let data

  /** @type {?import('@src/graphql').LightGame} */
  let gameToDelete = null
  /** @type {import('@src/graphql').AuthenticatedPlayer['player']} */
  let user
  /** @type {import('rxjs').Observable<import('@src/graphql').LightGame[]> }*/
  let games = /** @type {?} */ (readable(data.currentGames || []))
  /** @type {import('rxjs').Observable<import('@src/graphql').Friendship[]> }*/
  let friends = /** @type {?} */ (readable([]))
  /** @type {?{ title: string, maxSeats: number }} */
  let tooManyPlayersCatalogItem = null
  $: isDeletedLobby = isLobby(gameToDelete)

  $: if (data.session?.player) {
    user = data.session.player
    games = receiveGameListUpdates(data.currentGames ?? undefined)
    friends = listFriends()
  }

  $: if (browser && $page.url.searchParams.get('game-name')) {
    $page.url.searchParams.delete('game-name')
    goto($page.url.toString())
  }

  $: if (data.creationError) {
    toastError({ content: translateError($_, data.creationError) })
  }

  beforeNavigate(async ({ to }) => {
    if (user && isDifferentGame(to?.params?.gameId)) {
      await leaveGame(user)
    }
  })

  async function handleSelectGame(
    /** @type {CustomEvent<import('@src/graphql').LightGame>} */ {
      detail: game
    }
  ) {
    if (isLobby(game)) {
      if (game.id !== $currentGame?.id && user) {
        await leaveGame(user)
        enterGame(game)
      }
    } else {
      goto(`/${$locale}/game/${game.id}`)
    }
  }

  async function handleDeleteGame(
    /** @type {CustomEvent<import('@src/graphql').LightGame>} */ {
      detail: game
    }
  ) {
    gameToDelete = game
  }

  async function handleDeletionClose(
    /** @type {CustomEvent<boolean>} */ { detail: confirmed }
  ) {
    if (confirmed && gameToDelete) {
      await deleteGame(gameToDelete.id)
      toastInfo({
        contentKey: isDeletedLobby
          ? 'labels.lobby-deleted'
          : 'labels.game-deleted'
      })
    }
    gameToDelete = null
  }

  async function handleCreateGame(
    /** @type {CustomEvent<import('@src/graphql').CatalogItem & { title: string }>} */ {
      detail: { name, title, maxSeats = 2 }
    }
  ) {
    if ($currentGame) {
      if (
        maxSeats <
        ($currentGame?.players ?? []).filter(({ isGuest }) => !isGuest).length
      ) {
        tooManyPlayersCatalogItem = { title, maxSeats }
      } else {
        await promoteGame($currentGame.id, name)
      }
    } else {
      let creationUrl = `/${$locale}/home?game-name=${encodeURIComponent(name)}`
      if (user) {
        goto(creationUrl)
      } else {
        goto(`/${$locale}/login?redirect=${encodeURIComponent(creationUrl)}`)
      }
    }
  }

  async function handleCreateLobby() {
    await enterGame(await createGame())
  }

  function enterGame(/** @type {import('@src/graphql').Game} */ game) {
    return joinGame({
      gameId: game.id,
      .../** @type {import('@src/graphql').AuthenticatedPlayer} */ (
        data.session
      ),
      onDeletion: () => {
        toastInfo({ contentKey: 'labels.lobby-deleted-by-owner' })
      },
      onPromotion: promoted => {
        handleSelectGame(
          /** @type {CustomEvent<import('@src/graphql').LightGame>} */ ({
            detail: promoted
          })
        )
      }
    })
  }

  async function handleCloseLobby() {
    if (user) {
      await leaveGame(user)
    }
  }

  function sortCatalogByTitle(
    /** @type {import('@src/graphql').CatalogItem} */ { locales: gameA },
    /** @type {import('@src/graphql').CatalogItem} */ { locales: gameB }
  ) {
    return $comparator$.compare(
      gameA?.[$locale]?.title,
      gameB?.[$locale]?.title
    )
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
          {#each data.catalog.sort(sortCatalogByTitle) as game}
            <CatalogItem {game} on:select={handleCreateGame} />
          {/each}
        </section>
      </span>
      <PageFooter />
    </div>
    {#if user}
      <Aside
        game={$currentGame ?? null}
        {user}
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
{#if tooManyPlayersCatalogItem}
  <InfoDialogue
    open
    title={$_('titles.too-many-players')}
    message={$_('labels.too-many-players', tooManyPlayersCatalogItem)}
    on:close={() => (tooManyPlayersCatalogItem = null)}
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
