import { BehaviorSubject } from 'rxjs'

const engine$ = new BehaviorSubject(null)
const fps$ = new BehaviorSubject(0)

export const fps = fps$.asObservable()

export const engine = engine$.asObservable()

export function initEngine(engine) {
  engine.onFrameEnd.subscribe(() => fps$.next(engine.getFps().toFixed()))
  engine$.next(engine)
}
