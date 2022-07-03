import { BehaviorSubject } from 'rxjs'

/**
 * @typedef {object} Flags configuration flags
 * @property {boolean} useGithubProvider enables "Connect with Github" button.
 * @property {boolean} useGoogleProvider enables "Connect with Google" button.
 */
const flags$ = new BehaviorSubject({
  useGithubProvider: import.meta.env.WEB_USE_GITHUB_PROVIDER,
  useGoogleProvider: import.meta.env.WEB_USE_GOOGLE_PROVIDER
})

/**
 * @type {import('rxjs').Observable<Flags>}
 */
export const flags = flags$.asObservable()
