<style global type="postcss">
  @tailwind base;

  .material-icons {
    vertical-align: -0.2em;
  }

  html,
  body {
    @apply font-sans h-full overflow-hidden m-0;
    color: theme('colors.primary.text');
    background-color: theme('background.page');
  }

  body {
    @apply flex;
  }
</style>
