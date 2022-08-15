<script context="module">
  export async function load({ url, session }) {
    console.log('>> auth layout', url.origin, session)
    if (url.pathname !== '/login' && !session.user) {
      return {
        status: 302,
        redirect: `/login?redirect=${encodeURIComponent(
          url.href.replace(url.origin, '')
        )}`
      }
    }
    return { status: 200 }
  }
</script>

<script>
  import '../common'
</script>

<slot />
