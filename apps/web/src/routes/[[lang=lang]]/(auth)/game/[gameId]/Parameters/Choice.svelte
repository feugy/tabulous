<script>
  // @ts-check
  import { Dropdown } from '@src/components'
  import { gameAssetsUrl, injectLocale } from '@src/utils'
  import { _, locale } from 'svelte-intl'

  import { findViolations } from './utils'

  /** @type {string} property's name. */
  export let name
  /** @type {import('@tabulous/types').Schema<?>}} represented property. */
  export let property
  /** @type {import('@src/types').JSONValue} chosen values. */
  export let values

  // only build options for valid candidates
  /** @type {(import('@src/components').LabelMenuOption|import('@src/components').ColorMenuOption)[]} */
  $: options = findCandidates(property, name, values).map(value => {
    /** @type {import('@src/components').LabelMenuOption|import('@src/components').ColorMenuOption} */
    const result = {
      value,
      label: translate(value),
      image: findImage(property, value)
    }
    if (property.description === 'color') {
      result.color = value
    }
    return result
  })

  // value must be one of the option because DropDown + Menu are using strict equality
  $: value = options.find(candidate => candidate.value === values[name])

  // when defauling to first option, mutates values
  $: if (!value && options.length) {
    setTimeout(() => handleSelection({ detail: options[0] }), 0)
  }

  function handleSelection(
    /** @type {{ detail: import('@src/components').LabelMenuOption|import('@src/components').ColorMenuOption }} */ {
      detail
    }
  ) {
    values[name] = detail.value
  }

  function translate(/** @type {string} */ key) {
    return property.metadata?.[$locale]?.[key] ?? key
  }

  function findImage(
    /** @type {import('@tabulous/types').Schema<?>} */ property,
    /** @type {string} */ key
  ) {
    return property.metadata?.images?.[key]
  }

  function findCandidates(
    /** @type {import('@tabulous/types').Schema<?>} */ property,
    /** @type {string} */ name,
    /** @type {import('@src/types').JSONValue} */ values
  ) {
    const candidates = /** @type {import('@src/types').JSONValue[]} */ (
      property.enum
    )
    const schema = { type: 'object', properties: { [name]: property } }
    const result = candidates.filter(
      value => findViolations({ [name]: value }, schema, values).length === 0
    )
    return result
  }
</script>

<label for={name}>{translate('name') + $_('labels.colon')}</label>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<span on:click|preventDefault on:keyup|preventDefault>
  <Dropdown
    id={name}
    icon={property.description === 'color' ? 'color_lens' : undefined}
    {options}
    {value}
    on:select={handleSelection}
  />
  {#if value?.image}
    <img
      src="{gameAssetsUrl}{injectLocale(value.image, 'images', $locale)}"
      alt=""
    />
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
