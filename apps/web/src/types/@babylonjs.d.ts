/* eslint-disable no-unused-vars */
import type { Mesh, Observable } from '@babylonjs/core'
import type {
  AnchorBehavior,
  AnimateBehavior,
  DetailBehavior,
  DrawBehavior,
  FlipBehavior,
  LockBehavior,
  MoveBehavior,
  QuantityBehavior,
  RandomBehavior,
  RotateBehavior,
  StackBehavior,
  TargetBehavior
} from '@src/3d/behaviors'
import type { ActionOrMove, HistoryRecord, Managers } from '@src/3d/managers'
import type { Behavior } from '@src/3d/utils'
import type { Game } from '@src/graphql'
import type { GameWithSelections } from '@src/stores'
import type { MeshMetadata } from '@src/types'
import type { EngineState } from '@tabulous/types'
import type {
  ActionName,
  ButtonName,
  Mesh as SerializedMesh,
  PlayerPreference
} from '@tabulous/types'

interface LoadedData {
  /** Serialized game data. */
  game: GameWithSelections
  /** Players data. */
  playerData: {
    /** Current player id (to determine their hand)). */
    playerId: string
    /** Current player's preferences. */
    preference: Omit<PlayerPreference, 'playerId'>
    /** Map of hexadecimal color string for each player Id. */
    colorByPlayerId: Map<string, string>
  }
  /** Set to true to show Babylon's loading UI while loading assets. */
  initial?: boolean
  /** Set to true to reset managers (history, selection...) */
  newRound?: boolean
}

declare module '@babylonjs/core' {
  interface Engine {
    /** Indicates whether the engine is still loading data and materials. */
    isLoading: boolean
    /** Simulator bound to this engine, when relevant. */
    simulation: Engine | null
    /** A map of action ids by (localized) keystroke. */
    actionNamesByKey: Map<string, ActionName[]>
    /** A map of action ids by(mouse / finger) button. */
    actionNamesByButton: Map<ButtonName, ActionName[]>
    /** Emits while data and materials are being loaded. */
    onLoadingObservable: Observable<boolean>
    /** Emits just before disposing the engien, to allow synchronous access to its content. */
    onBeforeDisposeObservable: Observable<void>
    /** Managers configures with this engine. */
    managers: Managers
    /** Starts the rendering loop. */
    start(): void
    /**
     * Initializes the 3D engine and its managers, then loads all game and hand meshes.
     * Shows and hides Babylon's loading UI while loading assets (initial loading only).
     */
    load(params: LoadedData): Promise<void>
    /**
     * Serializes all meshes rendered in the game engines.
     */
    serialize(): EngineState
    /**
     * Applies a remote mesh selection from a peer player, unless replaying history.
     * @param selectedIds - selected mesh ids.
     * @param playerId - id of the selecting player.
     */
    applyRemoteSelection(selectedIds: string[], playerId: string): void

    /**
     * Applies a remote move or action from a peer player, unless replaying history.
     * @param actionOrMove - action or move from a peer.
     * @param playerId - id of the peer player.
     */
    applyRemoteAction(
      actionOrMove: ActionOrMove,
      playerId: string
    ): Promise<void>
  }

  interface AbstractMesh {
    /** Indicates a cylindric mesh like a round token. */
    isCylindric: boolean
    /** Indicates whether this mesh could be hit by a ray. */
    isHittable: boolean
    /** Indicates a mesh used for animation purpose that should not be serialized nor hitted. */
    isPhantom: boolean
    /** Indicates a mesh used as a drop zone (anchors, stacks).  */
    isDropZone: boolean
    /** Indicates a behavior's animation in progress (could be only one at a time). */
    animationInProgress: boolean
    /** List of children temporaly detached during animations  */
    detachedChildren: AbstractMesh[]
    /** Emits when a behavior's animation has ended. */
    onAnimationEnd: Observable<void>
    /** This mesh's attached behaviors. */
    behaviors: Behavior[]
    getBehaviorByName(name: 'anchorable'): ?AnchorBehavior
    getBehaviorByName(name: 'animatable'): ?AnimateBehavior
    getBehaviorByName(name: 'detailable'): ?DetailBehavior
    getBehaviorByName(name: 'drawable'): ?DrawBehavior
    getBehaviorByName(name: 'flippable'): ?FlipBehavior
    getBehaviorByName(name: 'lockable'): ?LockBehavior
    getBehaviorByName(name: 'movable'): ?MoveBehavior
    getBehaviorByName(name: 'quantifiable'): ?QuantityBehavior
    getBehaviorByName(name: 'randomizable'): ?RandomBehavior
    getBehaviorByName(name: 'rotable'): ?RotateBehavior
    getBehaviorByName(name: 'stackable'): ?StackBehavior
    getBehaviorByName(name: 'targetable'): ?TargetBehavior
    /** Metadata used to extend a mesh's state. */
    metadata: MeshMetadata
  }

  interface Scene {
    meshes: Mesh[]
    getMeshById(id: string): Mesh?
  }
}

declare global {
  interface Window {
    /**
     * Displays or hide Babylon.js debugger for a given scene.
     * @param main - whether to display main scene debugger.
     * @param hand - whether to display hand scene debugger.
     */
    toggleDebugger(main = true, hand = false): Promise<void>
  }
}
