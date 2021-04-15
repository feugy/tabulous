import { Workbench } from '@tabulous/workbench/src/workbench'

// TODO can we move init in an async function and let it be loaded within Workbench?
// TODO can Workbench take an array of path and import them? (possible CORS issue)
;(async () => {
  // ugly fix for peerjs https://github.com/peers/peerjs/issues/753
  window.parcelRequire = {}
  await import('../src/common')

  new Workbench({
    target: document.body,
    props: {
      tools: [
        (await import('./Discussion.tools.svelte')).default,
        (await import('./FPSViewer.tools.svelte')).default
      ]
    }
  })
})()
