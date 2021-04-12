<script>
  import { createEventDispatcher } from 'svelte'
  import { locale } from 'svelte-intl'

  export let toolsGroup = new Map()
  export let current = null
  export let increment = 1
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
    if (!current?.name.includes(`${name}/`)) {
      expanded = { ...expanded, [name]: !expanded[name] }
    }
  }
</script>

<style type="postcss">
  li {
    @apply cursor-pointer mt-2 select-none;

    &.current {
      @apply bg-yellow-500 text-gray-100;
    }

    & .expand {
      @apply text-gray-400;
    }

    & .symbol {
      @apply text-yellow-700;
    }
  }

  .tool {
    @apply inline-block pr-4 py-1;
    padding-left: var(--increment);
  }

  .collapsed {
    @apply hidden;
  }
</style>

<ul>
  {#each entries as [name, tool]}
    <li class:current={current === tool}>
      {#if tool instanceof Map}
        <div
          class="tool"
          style="--increment: {increment * 0.5}rem;"
          on:click={() => toggleExpansion(name)}
        >
          <span class="material-icons expand"
            >{expanded[name] ? 'expand_less' : 'expand_more'}</span
          ><span>{name}</span>
        </div>
        <div class="nested" class:collapsed={expanded[name] !== true}>
          <svelte:self
            toolsGroup={tool}
            {current}
            increment={increment + 1}
            on:select
          />
        </div>
      {:else}
        <div
          class="tool"
          style="--increment: {increment * 0.5}rem;"
          on:click={() => dispatch('select', tool)}
        >
          <span class="material-icons symbol">architecture</span><span>
            {name}
          </span>
        </div>
      {/if}
    </li>
  {/each}
</ul>
