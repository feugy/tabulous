<script>
  // @ts-check
  import { Button } from '@src/components'
  import { _ } from 'svelte-intl'

  /** @type {boolean} whether this form is disabled. */
  export let disabled = true
  /** @type {?string} optional url to redirect to. */
  export let redirect = null

  /** @type {?HTMLInputElement} */
  let acceptInput
  /** @type {?HTMLInputElement} */
  let ageInput
  let submitDisabled = true

  function handleChange() {
    submitDisabled = !acceptInput?.checked || !ageInput?.checked
  }
</script>

<form on:change={handleChange} method="POST">
  <fieldset>
    <input
      type="checkbox"
      id="accept"
      name="accept"
      value="true"
      bind:this={acceptInput}
      {disabled}
      required={true}
    />
    <label for="accept">{$_('labels.terms-accepted')}</label>
  </fieldset>
  <fieldset>
    <input
      type="checkbox"
      id="age"
      name="age"
      value="true"
      bind:this={ageInput}
      {disabled}
      required={true}
    />
    <label for="age">{$_('labels.old-enough')}</label>
  </fieldset>
  <input type="hidden" name="redirect" value={redirect} />
  <Button
    primary
    text={$_('actions.log-in')}
    icon="emoji_people"
    type="submit"
    disabled={submitDisabled}
  />
</form>

<style lang="postcss">
  form {
    @apply inline-flex flex-col py-8 gap-2;

    :global(& > button) {
      @apply self-center mt-4;
    }
  }

  input[disabled] + label {
    @apply text-$disabled;
  }
</style>
