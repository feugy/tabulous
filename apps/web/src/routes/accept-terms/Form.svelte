<script>
  import { _ } from 'svelte-intl'
  import { Button } from '../../components'

  export let disabled = true

  let acceptInput
  let ageInput
  let submitDisabled = true

  function handleChange() {
    submitDisabled = !acceptInput?.checked || !ageInput?.checked
  }
</script>

<form on:change={handleChange} on:submit|preventDefault>
  <fieldset>
    <input
      type="checkbox"
      id="accept"
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
      bind:this={ageInput}
      {disabled}
      required={true}
    />
    <label for="age">{$_('labels.old-enough')}</label>
  </fieldset>
  <Button
    text={$_('actions.log-in')}
    icon="emoji_people"
    type="submit"
    disabled={submitDisabled}
  />
</form>

<style lang="postcss">
  form {
    @apply inline-flex flex-col py-4 gap-2;

    :global(& > button) {
      @apply self-center;
    }
  }

  input[disabled] + label {
    @apply text-$disabled;
  }
</style>
