/* <script>
  import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
  import FPSViewer from "./FPSViewer.svelte";
</script>

<Meta title="Components/FPSViewer" component={FPSViewer} />

<Template let:args>
  <FPSViewer {...args} />
</Template>

<Story name="Default" args={{}} /> */

import FPSViewer from './FPSViewer.svelte'

export default {
  title: 'Components/FPSViewer'
}

export const Default = () => ({
  Component: FPSViewer,
  props: {}
})