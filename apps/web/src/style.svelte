<style global type="postcss">
  @import 'material-design-icons-iconfont';
  @import 'tailwindcss/base';
  @import 'tailwindcss/components';
  @import 'tailwindcss/utilities';

  .material-icons {
    vertical-align: -0.2em;
  }

  html,
  body {
    @apply font-sans h-full overflow-hidden m-0;
    background: theme('backgrounds.page');
    color: theme('colors.text');
  }

  .heading {
    @apply text-3xl border-b mb-4;
    border-bottom-color: theme('colors.primary.dark');
  }
</style>
