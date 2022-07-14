/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const { url } = event
  const response = await resolve(event, {
    ssr: canBeRenderedOnServer(url.pathname)
  })

  return response
}

function canBeRenderedOnServer(href) {
  return !href.startsWith('/home') && !href.startsWith('/game')
}
