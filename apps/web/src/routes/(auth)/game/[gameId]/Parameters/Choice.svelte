<script>
  import { Dropdown } from '@src/components'
  import { _, locale } from 'svelte-intl'

  export let name
  export let property
  export let value

  $: options = property?.enum?.map(value => ({
    value,
    label: translate(value) ?? value
  }))

  $: if (!value) {
    value = options[0]
  }

  function translate(key) {
    return property?.metadata?.[$locale][key] ?? key
  }
</script>

<fieldset on:click|preventDefault on:keyup|preventDefault>
  <label for={name}>{translate('name')}{$_('labels.colon')}</label>
  <Dropdown id={name} {options} bind:value />
</fieldset>

<style lang="postcss">
  label {
    @apply mr-4;
  }
</style>
