<script>
  import { Typeahead } from '../../src/components'

  export let withObject = false
  let options

  function findOptions() {
    options = withObject
      ? [{ label: 'Hello' }, { label: 'Salut' }, { label: 'Hallo' }]
      : ['Hello', 'Salut', 'Hallo']
  }
</script>

<Typeahead {options} on:change on:input={findOptions} />
