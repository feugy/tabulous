<script>
  // ts-check

  /** @type {string} component's width (css style). **/
  export let width = '100%'
  /** @type {string} component's height (css style). **/
  export let height = '100%'
  /** @type {import('@src/utils').CssColorVariables} css variable used as background color. **/
  export let tone = 'base-dark'

  $: background = `var(--${tone})`
  $: light = `var(--${computeLight(tone)})`

  function computeLight(
    /** @type {import('@src/utils').CssColorVariables} */ color
  ) {
    const [name, shade] = color.split('-')
    const newShade =
      shade === 'darkest'
        ? 'darker'
        : shade === 'darker'
        ? 'dark'
        : shade === 'dark'
        ? undefined
        : shade === undefined
        ? 'light'
        : shade === 'light'
        ? 'lighter'
        : 'lightest'
    return newShade ? `${name}-${newShade}` : name
  }
</script>

<span
  style:width
  style:height
  style:--background={background}
  style:--light={light}
/>

<style lang="postcss">
  span {
    @apply inline-block rounded-xl;
    background-color: var(--background);

    &::after {
      @apply block w-full h-full rounded-xl;
      background-color: var(--background);
      background: linear-gradient(
          135deg,
          var(--background) 30%,
          var(--light) 50%,
          var(--background) 70%
        )
        400% 0% / 200% 100% no-repeat;
      animation: shine 2s linear infinite;
      content: '';
    }
  }

  @keyframes shine {
    to {
      background-position: -400%;
    }
  }
</style>
