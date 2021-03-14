import { BehaviorSubject } from 'rxjs'

const fps$ = new BehaviorSubject(0)

export const fps = fps$.asObservable()

export function initEngine(engine) {
  engine.onEndFrameObservable.add(() => fps$.next(engine.getFps().toFixed()))
}
