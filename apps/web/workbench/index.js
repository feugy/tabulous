import { Workbench } from '@tabulous/workbench/src/workbench'

import '../src/common'
import Discussion from './Discussion.tools.svelte'
import FPSViewer from './FPSViewer.tools.svelte'

new Workbench({
  target: document.body,
  props: { tools: [Discussion, FPSViewer] }
})
