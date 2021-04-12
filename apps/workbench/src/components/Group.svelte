<script>
  import { createEventDispatcher } from 'svelte'
  import { locale } from 'svelte-intl'

  export let toolsGroup = new Map()
  export let current = null
  let expanded = {}

  const dispatch = createEventDispatcher()

  $: collator = new Intl.Collator($locale || undefined, { numeric: true })
  $: entries = [...toolsGroup?.entries()].sort(([name1], [name2]) =>
    collator.compare(name1, name2)
  )
  $: if (current && entries) {
    // automatically expand ancestors of the current tool
    const ancestor = entries.find(([leg]) => current.name.includes(`${leg}/`))
    if (ancestor) {
      expanded[ancestor[0]] = true
    }
  }

  function toggleExpansion(name) {
    // can collapse and expand any node but current tool's ancestors
    if (!current.name.includes(`${name}/`)) {
      expanded = { ...expanded, [name]: !expanded[name] }
    }
  }
</script>

<style type="postcss">
  li {
    @apply cursor-pointer pt-2;

    &.current {
      @apply underline;
    }
  }

  .tool {
    @apply inline-block;
  }

  .nested {
    @apply ml-2;
    transition: height ease-in-out 250ms;
  }

  .collapsed {
    @apply h-0 overflow-hidden;
  }
</style>

<ul>
  {#each entries as [name, tool]}
    <li class:current={current === tool}>
      {#if tool instanceof Map}
        <span on:click={() => toggleExpansion(name)}>{name}</span>
        <div class="nested" class:collapsed={expanded[name] !== true}>
          <svelte:self toolsGroup={tool} {current} on:select />
        </div>
      {:else}
        <span class="tool" on:click={() => dispatch('select', tool)}>
          {name}
        </span>
      {/if}
    </li>
  {/each}
</ul>
