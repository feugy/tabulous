export function build() {
  import('does-not-exist')
  return {
    mesh: []
  }
}
