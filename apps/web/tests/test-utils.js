import { get } from 'svelte/store'
import { _ } from 'svelte-intl'

export function translate(...args) {
  return get(_)(...args)
}

export async function sleep(time = 0) {
  return new Promise(resolve => setTimeout(resolve, time))
}
