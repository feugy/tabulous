/* eslint-disable no-unused-vars */
import type { JSONSchemaExport, JSONSchemaType } from 'ajv'

declare module '.' {
  /** A player account. */
  export interface Player {
    /** unique id. */
    id: string
    /** player user name. */
    username: string
    /** game this player is currently playing. */
    currentGameId: string | null
    /** avatar used for display. */
    avatar?: string
    /** player's authentication provider, when relevant. */
    provider?: string
    /** authentication provider own id, when relevant. */
    providerId?: string
    /** email from authentication provider, when relevant. */
    email?: string
    /** full name from the authentication provider, when relevant. */
    fullName?: string
    /** whether this player has accepted terms of service. */
    termsAccepted?: boolean
    /** the account password hash, when relevant. */
    password?: string
    /** whether this player has elevated priviledges or not. */
    isAdmin?: boolean
    /** list of copyrighted games this player has accessed to. */
    catalog?: string[]
    /** whether this player could by found when searching usernames. */
    usernameSearchable?: boolean
  }

  /** A Game descriptor in the game catalog */
  export interface GameDescriptor<
    Parameters extends Record<string, any> = object
  > {
    /** unique name. */
    name: string
    /** all the localized data fort his item. */
    locales: ItemLocales
    /** minimum seats required to play, when relevant. */
    minSeats?: number
    /** maximum seats allowed, when relevant. */
    maxSeats?: number
    /** minimum age suggested. */
    minAge?: number
    /** minimum time observed. */
    minTime?: number
    /** copyright data, meaning this item has restricted access. */
    copyright?: Copyright
    /** number of pages in the rules book, if any. */
    rulesBookPageCount?: number
    /** zoom specifications for main and hand scene. */
    zoomSpec?: ZoomSpec
    /** table specifications to customize visual. */
    tableSpec?: TableSpec
    /** allowed colors for players and UI. */
    colors?: ColorSpec
    /** action customizations. */
    actions?: ActionSpec
    /** function invoked build initial game. */
    build?: Build
    /** function invoked when a player joins a game for the first time. */
    addPlayer?: AddPlayer<Parameters>
    /** function invoked to generate a joining player's parameters. */
    askForParameters?: AskForParameters<Parameters>
    /** function invoked to compute score on an action */
    computeScore?: ComputeScore
  }

  /** All the localized data for a catalog item. */
  export type ItemLocales = Record<string, ?> & {
    /** French locale */
    fr?: ItemLocale
    /** English locale */
    en?: ItemLocale
  }

  /** Localized data */
  export type ItemLocale = Record<string, ?> & {
    /** catalog item title. */
    title: string
  }

  /** a game author, designer or publisher */
  export interface PersonOrCompany {
    /** this person/company's name */
    name: string
  }

  /** game copyright data */
  export type Copyright = Record<string, ?> & {
    /** game authors. */
    authors: PersonOrCompany[]
    /** game designers. */
    designers?: PersonOrCompany[]
    /** game publishers. */
    publishers?: PersonOrCompany[]
  }

  /** zoom specifications for main and hand scene. */
  export interface ZoomSpec {
    /** minimum zoom level allowed on the main scene. */
    min?: number
    /** maximum zoom level allowed on the main scene. */
    max?: number
    /** fixed zoom level for the hand scene. */
    hand?: number
  }

  /** table specifications for customization. */
  export interface TableSpec {
    /** minimum zoom level allowed on the main scene. */
    width?: number
    /** maximum zoom level allowed on the main scene. */
    height?: number
    /** texture image file path, or hex color. */
    texture?: string
  }

  /** players and UI color customization. */
  export interface ColorSpec {
    /** base hex color. */
    base?: string
    /** primary hex color. */
    primary?: string
    /** secondary hex color. */
    secondary?: string
    /** list of possible colors for players. */
    players?: string[]
  }

  export type ActionName =
    | 'decrement'
    | 'detail'
    | 'draw'
    | 'flip'
    | 'flipAll'
    | 'increment'
    | 'play'
    | 'pop'
    | 'push'
    | 'random'
    | 'reorder'
    | 'rotate'
    | 'setFace'
    | 'snap'
    | 'toggleLock'
    | 'unsnap'
    | 'unsnapAll'

  /** action buttons configuration. */
  export interface ActionSpec {
    /** actions assigned to tab/left click, if any. */
    button1?: ActionName[]
    /** actions assigned to long 2 fingers tap/long left click, if any */
    button2?: ActionName[]
  }

  /** Function to build a game setup. */
  export type Build = () => GameSetup | Promise<GameSetup>

  /** Function invoked when adding a player to the game. */
  export type AddPlayer<Parameters extends Record<string, any>> = (
    game: StartedGame,
    guest: Player,
    parameters: Parameters
  ) => StartedGame | Promise<StartedGame>

  export type Schema<Parameters extends Record<string, any>> =
    JSONSchemaType<Parameters>

  /** Parameters required to join a given game. */
  export type GameParameters<Parameters extends Record<string, any>> =
    GameData & {
      /** a JSON Export type Definition schema used to validate required parmeters. */
      schema: Schema<Parameters>
      /** validation error, when relevant. */
      error?: string
    }

  /** Function invoked when resolving game parameters for a joining player. */
  export type AskForParameters<Parameters> = (args: {
    game: GameData
    player: Player
  }) => ?(Schema<Parameters> | Promise<?Schema<Parameters>>)

  /** Function invoked to compute scores after a given action */
  export type ComputeScore = (
    action: ?Action,
    state: EngineState,
    players: Pick<Player, 'id' | 'username' | 'avatar'>[],
    preferences: PlayerPreference[]
  ) => Promise<Scores | undefined> | Scores | undefined

  /**
   * Setup for a given game instance, including meshes, bags and slots.
   * Meshes could be cards, round tokens, rounded tiles... They must have an id.
   * Use bags to randomize meshes, and use slots to assign them to given positions (and with specific properties).
   * Slot will stack onto meshes already there, optionnaly snapping them to an anchor.
   * Meshes remaining in bags after processing all slots will be removed.
   */
  export interface GameSetup {
    /** all meshes. */
    meshes?: Mesh[]
    /** map of randomized bags, as a list of mesh ids. */
    bags?: Map<string, string[]>
    /** a list of position slots */
    slots?: Slot[]
  }

  /**
   * Position slot for meshes.
   * A slot draw a mesh from a bag (`bagId`), and assigns it provided propertis (x, y, z, texture, movable...).
   *
   * Slots without an anchor picks as many meshes as needed (count), and stack them.
   * When there is no count, they exhaust the bag.
   *
   * Slots with an anchor (`anchorId`) draw as many mesh as needed (count),
   * snap the first to any other mesh with that anchor, and stack others on top of it.
   * `anchorId` may be a chain of anchors: "column-2.bottom.top" draw and snaps on anchor "top", of a mesh snapped on
   * anchor "bottom", of a mesh snapped on anchor "column-2".
   * If such configuration can not be found, the slot is ignored.
   *
   * NOTES:
   * 1. when using multiple slots on the same bag, slot with no count nor anchor MUST COME LAST.
   * 2. meshes remaining in bags after processing all slots will be removed.
   */
  export type Slot = {
    /** id of a bag to pick meshes. */
    bagId: string
    /** id of the anchor to snap to. */
    anchorId?: string
    /** number of mesh drawn from bag. */
    count?: number
  } & Partial<Mesh>

  /** an active game, or a lobby */
  export interface Game {
    /** unique game id. */
    id: string
    /** game creation timestamp. */
    created: number
    /** id of the player who created this game */
    ownerId: string
    /** game kind (relates with game descriptor). Unset means a waiting room. */
    kind?: string
    /** (active) player ids. */
    playerIds: string[]
    /** guest (future player) ids. */
    guestIds: string[]
  }

  /** Data of a game instance after setup was applied. */
  export type GameData = Game &
    GameDescriptor & {
      /** number of seats still available. */
      availableSeats: number
      /** game meshes. */
      meshes: Mesh[]
      /** game discussion thread, if any. */
      messages: Message[]
      /** player's saved camera positions, if any. */
      cameras: CameraPosition[]
      /** player's private hands, id any. */
      hands: Hand[]
      /** preferences for each players. */
      preferences: PlayerPreference[]
      /** player actions and move history. */
      history: HistoryRecord[]
      /** bundled rule engine sent to the client, if any */
      engineScript?: string
    }

  /** Data of a started game. */
  export type StartedGame = GameData &
    Required<Pick<GameData, 'meshes' | 'hands' | 'kind'>>

  /** Supported mesh shapes. */
  export type Shape =
    | 'box'
    | 'card'
    | 'custom'
    | 'die'
    | 'prism'
    | 'roundedTile'
    | 'roundToken'

  export interface Point {
    /** 3D coordinate along the X axis (horizontal). */
    x?: number
    /** 3D coordinate along the Z axis (vertical). */
    z?: number
    /** 3D coordinate along the Y axis (altitude). */
    y?: number
  }

  export interface Dimension {
    /** mesh's width (X axis), for boxes, cards, prisms, and rounded tiles. */
    width?: number
    /** mesh's height (Y axis), for boxes, cards, prisms, rounded tokens and rounded tiles. */
    height?: number
    /** mesh's depth (Z axis), for boxes, cards, and rounded tiles. */
    depth?: number
    /** mesh's diameter (X+Z axis), for round tokens and dice. */
    diameter?: number
  }

  /** A 3D mesh, with a given shape. Some of its attribute are shape-specific. */
  export type Mesh = {
    /** the mesh shape. */
    shape: Shape
    /** mesh unique id. */
    id: string
    /** path to its texture file or hex color. */
    texture: string
    /** list of face UV (Vector4 components), to map texture on the mesh (depends on its shape). */
    faceUV?: number[][]
    /** initial transformation baked into the mesh's vertices. */
    transform?: InitialTransform
    /** corner radius, for rounded tiles. */
    borderRadius?: number
    /** path to the custom mesh OBJ file. */
    file?: string
    /** number of edges, for prisms. */
    edges?: number
    /** number of faces, for dice. */
    faces?: number
    /** if this mesh could be detailed, contains details. */
    detailable?: DetailableState
    /** if this mesh could be moved, contains move state. */
    movable?: MovableState
    /** if this mesh could be flipped, contains flip state. */
    flippable?: FlippableState
    /** if this mesh could be rotated along Y axis, contains rotation state. */
    rotable?: RotableState
    /** if this mesh has anchors, contains their state. */
    anchorable?: AnchorableState
    /** if this mesh could be stack under others, contains stack state. */
    stackable?: StackableState
    /** if this mesh could be drawn in player hand, contains coonfiguration. */
    drawable?: DrawableState
    /** if this mesh could be locked, contains (un)locke state. */
    lockable?: LockableState
    /** if instances of this mesh could grouped together and split, contains quantity state. */
    quantifiable?: QuantifiableState
    /** if this mesh could be randomized, contains face state. */
    randomizable?: RandomizableState
  } & Point &
    Dimension

  /** 3D transforation baked into a mesh's vertices. */
  export interface InitialTransform {
    /** rotation along the Y axis. */
    yaw?: number
    /** rotation along the X axis. */
    pitch?: number
    /** rotation along the Z axis. */
    roll?: number
    /** scale applied along the X axis. */
    scaleX?: number
    /** scale applied along the Y axis. */
    scaleY?: number
    /** scale applied along the Z axis. */
    scaleZ?: number
  }

  /** State for detailable meshes. */
  export interface DetailableState {
    /** path to its front image. */
    frontImage: string
    /** path to its back image, when relevant. */
    backImage?: string
  }

  /** State for movable meshes. */
  export interface MovableState {
    /** move animation duration, in milliseconds. */
    duration?: number
    /** distance between dots of an imaginary snap grid. */
    snapDistance?: number
    /** kind used when dragging and droping the mesh over targets. */
    kind?: string
    /** when this mesh has serveral parts, coordinate of each part barycenter. */
    partCenters?: Point[]
  }

  /** State for flippable meshes. */
  export interface FlippableState {
    /** true means the back face is visible. */
    isFlipped?: boolean
    /** flip animation duration, in milliseconds. */
    duration?: number
  }

  /** state for flippable meshes: */
  export interface RotableState {
    /** rotation angle along Y axis (yaw), in radian. */
    angle?: number
    /** rotation animation duration, in milliseconds. */
    duration?: number
  }

  /** State for stackable meshes. */
  export type StackableState = _Targetable & {
    /** ordered list of ids for meshes stacked on top of this one. */
    stackIds?: string[]
    /** stack animations duration, in milliseconds. */
    duration?: number
    /** angle applied to any rotable mesh pushed to the stack. */
    angle?: number
  }

  /** State for anchorable meshes. */
  export interface AnchorableState {
    /** list of anchors. */
    anchors?: Anchor[]
    /** snap animation duration, in milliseconds. */
    duration?: number
  }

  /** An anchor definition (coordinates are relative to the parent mesh). */
  export type Anchor = {
    /** this anchor id. */
    id: string
    /** ids of meshes currently snapped to this anchor. */
    snappedIds: string[]
    /** when set, only this player can snap meshes to this anchor. */
    playerId?: string
    /** when set, angle applied to any rotable mesh snapped to the anchor. */
    angle?: number
    /** when set, flip state applied to any flippable mesh snapped to the anchor. */
    flip?: boolean
    /** when set, and when snapping a multi-part mesh, takes it barycenter into account. */
    ignoreParts?: boolean
    /** maximum number of snapped meshes, defaults to 1 */
    max?: number
  } & Point &
    Dimension &
    _Targetable

  /** State for drawable meshes. */
  export interface DrawableState {
    /** unflip flipped mesh when picking them in hand. */
    unflipOnPick?: boolean
    /** flip flipable meshes when playing them from hand. */
    flipOnPlay?: boolean
    /** set angle of rotable meshes when picking them in hand. */
    angleOnPick?: number
    /** duration (in milliseconds) of the draw animation. */
    duration?: number
  }

  /** State for locable mehes. */
  export interface LockableState {
    /** whether this mesh is locked or not. */
    isLocked?: boolean
  }

  /** State for quantifiable meshes. */
  export type QuantifiableState = _Targetable & {
    /** number of items, including this one. */
    quantity?: number
    /** duration (in milliseconds) when pushing individual meshes. */
    duration?: number
  }

  /** State for randomizable meshes. */
  export interface RandomizableState {
    /** current face set. */
    face?: number
    /** duration (in milliseconds) of the random animation. The set animartion is a third of it. */
    duration?: number
    /** whether face could be manually set or not. */
    canBeSet?: boolean
  }

  /** A message in the discussion thread. */
  export interface Message {
    /** sender id. */
    playerId: string
    /** message's textual content. */
    text: string
    /** creation timestamp. */
    time: number
  }

  /**
   * A saved Arc rotate camera position
   * @see https://doc.babylonjs.com/divingDeeper/cameras/camera_introduction#arc-rotate-camera
   */
  export interface CameraPosition {
    /** hash for this position, to ease comparisons and change detections. */
    hash: string
    /** id of the player for who this camera position is relevant. */
    playerId: string
    /** 0-based index for this saved position. */
    index: number
    /** 3D cooordinates of the camera target, as per Babylon's specs. */
    target: number[]
    /** the longitudinal rotation, in radians. */
    alpha?: number
    /** the longitudinal rotation, in radians. */
    beta: number
    /** the distance from the target (Babylon's radius). */
    elevation: number
  }

  /** A player's private hand. */
  export interface Hand {
    /** owner id. */
    playerId: string
    /** ordered list of meshes. */
    meshes: Mesh[]
  }

  /** Preferences collected with game parameters for a given player. */
  export type PlayerPreference = Record<string, ?> & {
    /** if of this player. */
    playerId: string
    /** hex color for this player, if any. */
    color?: string
    /** yaw (Y angle) on the table, if any. */
    angle?: number
  }

  /** An action in the game history. */
  export type PlayerAction = _HistoryRecord & {
    /** name of the applied action. */
    fn: ActionName
    /** stringified arguments for this action. */
    argsStr: string
    /** optional stringified arguments for reverting this action. */
    revertStr?: string
  }

  /** A move in the game history. */
  export type PlayerMove = _HistoryRecord & {
    /** absolute position. */
    pos: number[]
    /** previous absolute position. */
    prev: number[]
  }

  export type HistoryRecord = PlayerAction | PlayerMove

  /** A relationship between two players. */
  export interface Friendship {
    /** id of the target player (origin player is implicit). */
    playerId: string
    /** when true, indicates a friendship request from the target player. */
    isRequest?: boolean
    /** when true, indicates a friendship request sent to the target player. */
    isProposal?: boolean
  }

  /** An update on a friendship relationship. */
  export interface FriendshipUpdate {
    /** player sending the update. */
    from: string
    /** player receiving the update. */
    to: string
    /** indicates that sender requested friendship. */
    requested?: boolean
    /** indicates that sender proposed new friendship. */
    proposed?: boolean
    /** whether the relationship is accepted. */
    accepted?: boolean
    /** whether the relationship is decline. */
    declined?: boolean
  }

  /** Used to connect to the turn server */
  export interface TurnCredentials {
    /** unix timestamp representing the expiry date. */
    username: string
    /** required to connect. */
    credentials: string
  }

  /** Local game engine serialized state. */
  export type EngineState = {
    meshes: Mesh[]
    handMeshes: Mesh[]
    history: HistoryRecord[]
  }

  /** applied action to a given mesh. */
  export interface Action {
    /** name of the applied action. */
    fn: ActionName
    /** modified mesh id. */
    meshId: string
    /** indicates whether this action comes from hand or main scene. */
    fromHand: boolean
    /** modified mesh id. */
    meshId: string
    /** indicates whether this action comes from hand or main scene. */
    fromHand: boolean
    /** argument array for this action. */
    args: any[]
    /** when action can't be reverted with the same args, specific data required. */
    revert?: any[]
    /** optional animation duration, in milliseconds. */
    duration?: number
    /** indicates a local action that should not be re-recorded nor sent to peers. */
    isLocal?: boolean
  }

  /** applied move to a given mesh: */
  export interface Move {
    /** absolute position. */
    pos: number[]
    /** absolute position before the move. */
    prev: number[]
    /** optional animation duration, in milliseconds. */
    duration?: number
    /** modified mesh id. */
    meshId: string
    /** indicates whether this action comes from hand or main scene. */
    fromHand: boolean
  }

  export type ActionOrMove = Action | Move

  /** A given player's score, with optional components */
  export type Score = Record<string, number> & { total: number }

  /** All player scores */
  export type Scores = Record<string, Score>
}

/** Common properties for targets (stacks, anchors, quantifiable...) */
type _Targetable = {
  /** acceptable meshe kinds, that could be snapped to the anchor. Leave undefined to accept all. */
  kinds?: string[]
  /** dimension multiplier applied to the drop target. */
  extent?: number
  /** priority applied when multiple targets with same altitude apply. */
  priority?: number
  /** whether this anchor is enabled or not. */
  enabled?: boolean
}

/** Common properties for history records. */
type _HistoryRecord = {
  /** when this record happened (timestamp). */
  time: number
  /** who created this record. */
  playerId: string
  /** modified mesh id. */
  meshId: string
  /** whether this operation happened in this player's hand. */
  fromHand: boolean
  /** optional animation duration, in milliseconds. */
  duration?: number
}
