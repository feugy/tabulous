/* eslint-disable no-unused-vars */
import type { Observable } from 'rxjs'

declare module 'svelte/store' {
  function get<T>(observable: Observable<T>): T
}
