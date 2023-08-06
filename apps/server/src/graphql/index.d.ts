/* eslint-disable no-unused-vars */
import type { ActionSpec, GameDescriptor } from '../services/catalog'
import type * as games from '../services/games'
import type * as players from '../services/players'
import type * as creds from '../services/turn-credentials'
import type { Level } from '../utils/logger'

// Generated from catalog.graphql
export type CatalogItem = Pick<GameDescriptor, 'name' | 'locales'> &
  Partial<
    Pick<
      GameDescriptor,
      'copyright' | 'minSeats' | 'maxSeats' | 'minAge' | 'maxAge' | 'minTime'
    >
  >

export type {
  ActionName,
  ActionSpec,
  ColorSpec,
  Copyright,
  ItemLocale,
  ItemLocales,
  TableSpec,
  ZoomSpec
} from '../services/catalog'

export type ButtonName = keyof ActionSpec

export interface GrantAccessArgs {
  playerId: string // player id being granted access.
  itemName: string // granted catalog item name.
}

export interface RevokeAccessArgs {
  playerId: string // player id being granted access.
  itemName: string // granted catalog item name.
}

// Generated from games.graphql

export type GamePlayer = players.Player & {
  isGuest?: boolean
  isOwner?: boolean
}

export type Game = Pick<
  games.GameData,
  | 'id'
  | 'created'
  | 'kind'
  | 'rulesBookPageCount'
  | 'zoomSpec'
  | 'tableSpec'
  | 'colors'
  | 'actions'
> &
  Partial<
    Pick<
      games.GameData,
      | 'messages'
      | 'locales'
      | 'meshes'
      | 'cameras'
      | 'hands'
      | 'preferences'
      | 'availableSeats'
    >
  > & { players?: GamePlayer[] }

export type {
  Anchor,
  AnchorableState,
  CameraPosition,
  DetailableState,
  Dimension,
  DrawableState,
  FlippableState,
  Hand,
  InitialTransform,
  LockableState,
  Mesh,
  Message,
  MovableState,
  PlayerPreference,
  Point,
  QuantifiableState,
  RandomizableState,
  RotableState,
  Shape,
  StackableState,
  Targetable
} from '../services/games'

export type GameParameters = Pick<
  games.GameParameters,
  'error' | 'id' | 'kind'
> &
  Partial<
    Pick<
      games.GameParameters,
      | 'locales'
      | 'preferences'
      | 'rulesBookPageCount'
      | 'availableSeats'
      | 'colors'
    >
  > & { schemaString?: string; players?: GamePlayer[] }

export interface CreateGameArgs {
  kind?: string // created game kind (omit to create a lobby).
}

export interface JoinGameArgs {
  gameId: string // joined game's id.
  parameters?: string //player's provided parameters in a stringified object.
}

export interface PromoteGameArgs {
  gameId: string // promoted game's id.
  kind: string // promoted game kind.
}

export interface SaveGameArgs {
  game: Pick<Game, 'id' | 'meshes' | 'messages' | 'cameras' | 'hands'> // saved game data
}

export interface DeleteGameArgs {
  gameId: string // deleted game's id.
}

export interface InviteArgs {
  gameId: string // game's id.
  playerIds: string[] // invited player ids.
}

export interface KickArgs {
  gameId: string // game's id.
  playerId: string // kicked player id.
}

export interface ReceiveGameUpdatesArgs {
  gameId: string // game's id.
}

// From logger.graphql LoggerLevel and InputLoggerLevel
export interface LoggerLevel {
  name: string // logger name.
  level: Level // current log level.
}

// Generated from players.graphql
export type Player = Pick<players.Player, 'id' | 'username'> &
  Partial<
    Pick<
      players.Player,
      | 'currentGameId'
      | 'avatar'
      | 'provider'
      | 'email'
      | 'termsAccepted'
      | 'isAdmin'
      | 'usernameSearchable'
    >
  >

export type Friendship = { player: Player } & Pick<
  players.Friendship,
  'isRequest' | 'isProposal'
>

export type FriendshipUpdate = { from: Player } & Pick<
  players.FriendshipUpdate,
  'requested' | 'proposed' | 'accepted' | 'declined'
>

export type TurnCredentials = creds.TurnCredentials

export interface PlayerWithTurnCredentials {
  token: string // authentication token.
  player: Player // authenticated player.
  turnCredentials: creds.TurnCredentials // credentials for the TURN server.
}

export interface SearchPlayersArgs {
  search: string // searched text.
  includeCurrent?: boolean // whether to include current player in results or not.
}

export interface ListPlayersArgs {
  from?: number // index of the first result returned.
  size?: number // number of return results.
}

export interface AddPlayerArgs {
  id: string // created player id.
  username: string // created player username.
  password: string // created player password (clear value).
}

export interface LogInArgs {
  id: string // user account id.
  password: string // clear password.
}

export interface UpdateCurrentPlayerArgs {
  username?: string // new username value, if any.
  avatar?: string // new avatar value, if any.
  usernameSearchable?: boolean // new value for username searchability, if any.
}
// for deletePlayer, sendFriendRequest, requestFriendship, acceptFriendship, endFriendship mutations
export interface TargetedPlayerArgs {
  id: string // id of the targeted player.
}

// Generated from signal.graphql

export interface Signal {
  from: string // player id sending this signal.
  data: string // the signal payload.
}

export interface SendSignalArgs {
  signal: { to: string; data: string } // player id to which the signal is sent and the signal payload.
}

export interface AwaitSignalArgs {
  gameId: string // game's id.
}