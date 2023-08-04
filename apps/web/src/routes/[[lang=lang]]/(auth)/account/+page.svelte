<script>
  // @ts-check
  /** @typedef {import('@src/graphql').FullPlayer} Player */

  import {
    Button,
    Header,
    Input,
    PageFooter,
    Pane,
    PlayerThumbnail,
    Progress,
    UsernameSearchability
  } from '@src/components'
  import { updateCurrentPlayer } from '@src/stores'
  import { translateError } from '@src/utils'
  import { debounceTime, finalize, from, Subject, switchMap, tap } from 'rxjs'
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-intl'

  import { invalidate } from '$app/navigation'

  import AvatarDialogue from './AvatarDialogue.svelte'

  /** @type {import('./$types').PageData} */
  export let data

  /** @type {Subject<string>} */
  const username$ = new Subject()
  /** @type {Player} */
  let user = data.session?.player ?? {
    username: '',
    id: '',
    currentGameId: null
  }
  let isSaving = false
  /** @type {?Error} */
  let usernameError = null
  let openAvatarDialogue = false
  let avatar = user.avatar

  const saveSubscription = username$
    .pipe(
      tap(() => (usernameError = null)),
      debounceTime(500),
      switchMap(username => {
        isSaving = true
        return from(
          updateCurrentPlayer(username)
            // updates page data with new user details
            .then(() => invalidate('data:session'))
            .then(() => (user.username = username))
            .catch(error => (usernameError = error))
        ).pipe(finalize(() => (isSaving = false)))
      })
    )
    .subscribe()

  onDestroy(() => saveSubscription.unsubscribe())

  function handleSave(/** @type {Event} */ { target }) {
    username$.next(/** @type {HTMLInputElement} */ (target).value)
  }

  async function handleCloseAvatarDialogue(
    /** @type {CustomEvent<boolean>} */ { detail: confirmed }
  ) {
    if (confirmed) {
      user.avatar = (await updateCurrentPlayer(user.username, avatar)).avatar
    }
    avatar = user.avatar
  }
</script>

<svelte:head>
  <title>{$_('page-titles.account')}</title>
</svelte:head>

<main>
  <i id="top" />
  <Header {user}>
    <h1>
      {$_('titles.account')}
    </h1>
  </Header>
  <section>
    <Pane title={$_('titles.auth-provider')}>
      <fieldset>
        {#if user.provider}
          <div>{$_('labels.oauth-provider', user)}</div>
        {:else}
          <div>{$_('labels.manual-provider', user)}</div>
        {/if}
        <label for="username">{$_('labels.username')}</label>
        <span class="with-progress">
          <Input
            name="username"
            value={user.username}
            disabled={isSaving}
            on:input={handleSave}
          />
          <span
            >{#if isSaving}<Progress radius={24} />{/if}</span
          >
          {#if usernameError}
            <span class="error">{translateError($_, usernameError)}</span>
          {/if}
        </span>
        <label for="avatar">{$_('labels.avatar')}</label>
        <span class="aligned">
          <PlayerThumbnail player={user} dimension={150} />
          <Button
            id="avatar"
            text={$_('actions.change-avatar')}
            on:click={() => (openAvatarDialogue = true)}
          />
          <AvatarDialogue
            bind:open={openAvatarDialogue}
            bind:avatar
            on:close={handleCloseAvatarDialogue}
          />
        </span>
        <span>{$_('labels.searchability')}</span>
        <UsernameSearchability searchable={user.usernameSearchable} />
      </fieldset>
    </Pane>
  </section>
  <PageFooter />
</main>

<style lang="postcss">
  main {
    @apply flex flex-col;
  }

  section {
    @apply flex flex-col flex-1 p-6 self-center w-full xl:w-screen-xl;
  }

  fieldset {
    @apply mt-4 grid gap-x-8 gap-y-4 grid-cols-[auto,1fr] items-center;

    :nth-child(even) {
      font-family: var(--font-heading);
    }

    div {
      @apply col-span-2;
    }
  }

  .with-progress {
    @apply grid grid-cols-[1fr,auto] items-center;
  }

  .aligned {
    @apply flex items-center gap-8 flex-wrap;
  }

  .error {
    @apply text-$accent-warm;
  }
</style>
