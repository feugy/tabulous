<script>
  // @ts-check
  /** @typedef {import('@src/components').LabelMenuOption} LabelMenuOption */

  import { Typeahead } from '@src/components'

  export let withObject = false
  /** @type {((Record<string, ?> & string)|LabelMenuOption)[]} */
  let options

  function findOptions() {
    options = /** @type {?} */ (
      withObject
        ? [{ label: 'Hello' }, { label: 'Salut' }, { label: 'Hallo' }]
        : ['Hello', 'Salut', 'Hallo']
    )
  }
</script>

<Typeahead {options} on:change on:input={findOptions} />
