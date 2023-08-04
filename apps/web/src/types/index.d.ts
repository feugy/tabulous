/* eslint-disable no-unused-vars */
import type { Observable, Observer } from '@babylonjs/core'
import type {
  AnchorableState,
  AnchorBehavior,
  DetailableState,
  DetailBehavior,
  DrawBehavior,
  FlipBehavior,
  FlippableState,
  LockableState,
  LockBehavior,
  MovableState,
  QuantifiableState,
  QuantityBehavior,
  RandomBehavior,
  RandomizableState,
  RotableState,
  RotateBehavior,
  StackBehavior
} from '@src/3d/behaviors'
import type { Mesh as SerializedMesh } from '@tabulous/server/src/graphql/types'
import type { Observable as RxObservable, Subject } from 'rxjs'
import type { ComponentType } from 'svelte'

declare module '@src/types' {
  type Translate = (
    msg: string,
    args?: object,
    locales?: string | string[]
  ) => string

  type DeepRequired<T> = {
    [K in keyof T]: Required<DeepRequired<T[K]>>
  }

  type JSONValue =
    | string
    | number
    | boolean
    | Record<string, JSONValue>
    | Array<JSONValue>
    | undefined

  type BabylonToRxMapping = {
    observable: Observable<?>
    subject: Subject<?>
    observer: ?Observer<?>
  }

  type Observed<T> = T extends RxObservable<infer U> ? U : T
  type ArrayItem<T> = T extends Array<infer U> ? U : T

  type MeshActions = {
    snap: AnchorBehavior['snap']
    unsnap: AnchorBehavior['unsnap']
    unsnapAll: AnchorBehavior['unsnapAll']
    detail: DetailBehavior['detail']
    draw: DrawBehavior['draw']
    flip: FlipBehavior['flip']
    toggleLock: LockBehavior['toggleLock']
    increment: QuantityBehavior['increment']
    decrement: QuantityBehavior['decrement']
    random: RandomBehavior['random']
    setFace: RandomBehavior['setFace']
    rotate: RotateBehavior['rotate']
    push: StackBehavior['push']
    pop: StackBehavior['pop']
    reorder: StackBehavior['reorder']
    flipAll: StackBehavior['flipAll']
  }

  type MeshMetadata = Record<string, ?> & {
    serialize: () => SerializedMesh

    anchors?: AnchorableState['anchors']
    snap?: AnchorBehavior['snap']
    unsnap?: AnchorBehavior['unsnap']
    unsnapAll?: AnchorBehavior['unsnapAll']

    frontImage?: DetailableState['frontImage']
    backImage?: DetailableState['backImage']
    detail?: DetailBehavior['detail']

    draw?: DrawBehavior['draw']

    isFlipped?: FlippableState['isFlipped']
    flip?: FlipBehavior['flip']

    isLocked?: LockableState['isLocked']
    toggleLock?: LockBehavior['toggleLock']

    partCenters?: MovableState['partCenters']

    quantity?: QuantifiableState['quantity']
    increment?: QuantityBehavior['increment']
    decrement?: QuantityBehavior['decrement']
    canIncrement?: QuantityBehavior['canIncrement']

    face?: RandomizableState['face']
    maxFace?: RandomizableState['max']
    random?: RandomBehavior['random']
    setFace?: RandomBehavior['setFace']

    angle?: RotableState['angle']
    rotate?: RotateBehavior['rotate']

    stack?: StackBehavior['stack']
    push?: StackBehavior['push']
    pop?: StackBehavior['pop']
    reorder?: StackBehavior['reorder']
    flipAll?: StackBehavior['flipAll']
    canPush?: StackBehavior['canPush']
  }
}

interface OptionProps {
  focus?: boolean // whether this option is focused.
  open?: boolean // whether this option is opened (for nested menus).
}

type CommonMenuOption = Record<string, ?> & {
  props?: Record<string, ?> & OptionProps // properties passed to the svelte component, and updated on hover.
  icon?: string // optional icon.
  disabled?: boolean // whether this option is disabled.
}

declare module '@src/components' {
  interface ComponentMenuOption extends CommonMenuOption {
    Component: ComponentType // Svelte component for this option.
  }

  interface LabelMenuOption extends CommonMenuOption {
    label: string // text displayed.
  }

  interface ColorMenuOption extends CommonMenuOption {
    color: string // color displayed (hexcode or color name).
  }

  type MenuOption =
    | (Record<string, ?> & string)
    | ComponentMenuOption
    | LabelMenuOption
    | ColorMenuOption

  interface SectionTab {
    id: string // mandatory id used to identify tabs.
    icon: string // icon displayed.
    key?: string // shortcut key assigned, if any.
  }
}
