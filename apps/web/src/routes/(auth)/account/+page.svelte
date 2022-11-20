<script>
  import {
    Button,
    Header,
    Input,
    PlayerThumbnail,
    Progress
  } from '@src/components'
  import { updateCurrentPlayer } from '@src/stores'
  import { translateError } from '@src/utils'
  import { debounceTime, finalize, from, Subject, switchMap, tap } from 'rxjs'
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-intl'

  import { invalidateAll } from '$app/navigation'

  import AvatarDialogue from './AvatarDialogue.svelte'

  /** @type {import('./$types').PageData} */
  export let data = {}

  const username$ = new Subject()
  let user = data.session.player
  let isSaving = false
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
            .then(invalidateAll)
            .then(() => (user.username = username))
            .catch(error => (usernameError = error))
        ).pipe(finalize(() => (isSaving = false)))
      })
    )
    .subscribe()

  onDestroy(() => saveSubscription.unsubscribe())

  function handleSave({ target }) {
    username$.next(target.value)
  }

  async function handleCloseAvatarDialogue({ detail: confirmed }) {
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
  <Header
    {user}
    breadcrumb={[
      { label: $_('labels.home'), href: '/home' },
      { label: $_('labels.account') }
    ]}
  >
    <h1>
      {$_('titles.account')}
    </h1>
  </Header>
  <section>
    <h2>{$_('titles.auth-provider')}</h2>
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
      <span>{$_('labels.avatar')}</span>
      <span class="aligned">
        <PlayerThumbnail player={user} dimension={150} />
        <Button
          text={$_('actions.change-avatar')}
          on:click={() => (openAvatarDialogue = true)}
        />
        <AvatarDialogue
          bind:open={openAvatarDialogue}
          bind:avatar
          on:close={handleCloseAvatarDialogue}
        />
      </span>
    </fieldset>
  </section>
</main>

<style lang="postcss">
  main {
    @apply flex flex-col h-full w-full;
  }

  h1 {
    @apply text-3xl py-4;
  }

  h2 {
    @apply text-2xl pb-4;
  }

  section {
    @apply my-8 p-8 self-center lg:w-3/4 border rounded-md;
  }

  fieldset {
    @apply grid gap-x-8 gap-y-4 grid-cols-[auto,1fr] items-center;

    div {
      @apply col-span-2;
    }
  }

  .with-progress {
    @apply grid grid-cols-[1fr,auto] items-center;
  }

  .aligned {
    @apply flex items-center gap-4;
  }

  .error {
    @apply text-$accent-warm;
  }
</style>
