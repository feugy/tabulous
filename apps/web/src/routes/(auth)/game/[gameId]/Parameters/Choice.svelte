<script>
  import { Dropdown } from '@src/components'
  import { gameAssetsUrl } from '@src/utils'
  import { _, locale } from 'svelte-intl'

  export let name
  export let property
  export let value

  $: options = property?.enum?.map(value => ({
    value,
    label: translate(value) ?? value,
    image: property.metadata?.images?.[value]
  }))

  $: if (!value) {
    value = options[0]
  }

  function translate(key) {
    return property?.metadata?.[$locale][key] ?? key
  }
</script>

<label for={name}>{translate('name')}{$_('labels.colon')}</label>
<span on:click|preventDefault on:keyup|preventDefault>
  <Dropdown id={name} {options} bind:value />
  {#if value?.image}
    <img src="{gameAssetsUrl}{value.image}" alt="" />
  {/if}
</span>

<style lang="postcss">
  label {
    @apply leading-[2.5] text-right;
  }

  span {
    @apply flex items-start;
  }

  img {
    @apply inline-block ml-4;
    max-width: 33vw;
    max-height: 50vh;
  }
</style>
