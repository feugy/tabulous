<script>
  import { Dropdown } from '@src/components'
  import { gameAssetsUrl } from '@src/utils'
  import { _, locale } from 'svelte-intl'
  
  import { findViolations } from './utils'

  export let name
  export let property
  export let values

  // only build options for valid candidates
  $: options = findCandidates(property, name, values).map(value => ({
    value,
    label: translate(value),
    image: findImage(property, value)
  }))

  // value must be one of the option because DropDown + Menu are using strict equality
  $: value = options.find(candidate => candidate.value === values[name])

  // when defauling to first option, mutates values
  $: if (!value && options.length) {
    handleSelection({ detail: options[0] })
  }

  function handleSelection({ detail }) {
    values[name] = detail.value
  }

  function translate(key) {
    return property.metadata?.[$locale]?.[key] ?? key
  }

  function findImage(property, key) {
    return property.metadata?.images?.[key]
  }

  function findCandidates(property, name, values) {
    const candidates = property.enum
    const schema = { type: 'object', properties: { [name]: property } }
    const result = candidates.filter(
      value => findViolations({ [name]: value }, schema, values).length === 0
    )
    return result
  }
</script>

<label for={name}>{translate('name') + $_('labels.colon')}</label>
<span on:click|preventDefault on:keyup|preventDefault>
  <Dropdown id={name} {options} {value} on:select={handleSelection} />
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
