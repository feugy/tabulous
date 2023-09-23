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
import type { ActionOrMove, Managers } from '@src/3d/managers'
import type { Behavior } from '@src/3d/utils'
import type { Game } from '@src/graphql'
import type { GameWithSelections } from '@src/stores'
import type { MeshMetadata } from '@src/types'
import type {
  ActionName,
  ButtonName,
  HistoryRecord,
  Mesh as SerializedMesh,
  PlayerPreference
} from '@tabulous/server/src/graphql'

interface LoadPlayerData {
  /** current player id (to determine their hand)). */
  playerId: string
  /** current player's preferences. */
  preferences: Omit<PlayerPreference, 'playerId'>
  /** map of hexadecimal color string for each player Id. */
  colorByPlayerId: Map<string, string>
}

declare module '@babylonjs/core' {
  interface Engine {
    /** indicates whether the engine is still loading data and materials. */
    isLoading: boolean
    /** simulator bound to this engine, when relevant. */
    simulation: Engine | null
    /** a map of action ids by (localized) keystroke. */
    actionNamesByKey: Map<string, ActionName[]>
    /** a map of action ids by(mouse / finger) button. */
    actionNamesByButton: Map<ButtonName, ActionName[]>
    /** emits while data and materials are being loaded. */
    onLoadingObservable: Observable<boolean>
    /** emits just before disposing the engien, to allow synchronous access to its content. */
    onBeforeDisposeObservable: Observable<void>
    /** managers configures with this engine. */
    managers: Managers
    /** starts the renderig loop. */
    start(): void
    /**
     * loads all meshes into the game engine
     * - shows and hides Babylon's loading UI while loading assets (initial loading only)
     * - loads data into the main scene
     * - if needed, loads data into player's hand scene
     * @param game - serialized game data.
     * @param playerData - players data.
     * @param inital - set to true to show Babylon's loading UI while loading assets.
     */
    load(
      game: GameWithSelections,
      playerData: LoadPlayerData,
      inital?: boolean
    ): Promise<void>
    /**
     * serializes all meshes rendered in the game engines.
     */
    serialize(): {
      meshes: SerializedMesh[]
      handMeshes: SerializedMesh[]
      history: HistoryRecord[]
    }
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
    /** indicates a cylindric mesh like a round token. */
    isCylindric: boolean
    /** indicates whether this mesh could be hit by a ray. */
    isHittable: boolean
    /** indicates a mesh used for animation purpose that should not be serialized nor hitted. */
    isPhantom: boolean
    /** indicates a mesh used as a drop zone (anchors, stacks).  */
    isDropZone: boolean
    /** indicates a behavior's animation in progress (could be only one at a time). */
    animationInProgress: boolean
    /** List of children temporaly detached during animations  */
    detachedChildren: AbstractMesh[]
    /** emits when a behavior's animation has ended. */
    onAnimationEnd: Observable<void>
    /** this mesh's attached behaviors. */
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
    /** metadata used to extend a mesh's state. */
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
