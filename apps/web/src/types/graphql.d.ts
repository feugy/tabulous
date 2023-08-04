/* eslint-disable no-unused-vars */
import type { DeepRequired } from '@src/types'
import type {
  AwaitSignalArgs,
  CatalogItem as FullCatalogItem,
  CreateGameArgs,
  DeleteGameArgs,
  Friendship as FullFriendship,
  FriendshipUpdate as FullFriendshipUpdate,
  Game as FullGame,
  GameParameters,
  GamePlayer,
  InviteArgs,
  JoinGameArgs,
  KickArgs,
  LogInArgs,
  Player,
  PlayerWithTurnCredentials as FullPlayerWithTurnCredentials,
  PromoteGameArgs,
  ReceiveGameUpdatesArgs,
  SaveGameArgs,
  SearchPlayersArgs,
  SendSignalArgs,
  Signal,
  TargetedPlayerArgs,
  UpdateCurrentPlayerArgs
} from '@tabulous/server/src/graphql/types'
import type { TypedDocumentNode } from '@urql/core'

declare module '@src/graphql' {
  // catalog.graphql
  type CatalogItem = Omit<FullCatalogItem, 'maxAge'>
  const listCatalog: TypedDocumentNode<{
    listCatalog: CatalogItem[]
  }>

  // games.graphql
  type LightPlayer = Pick<
    GamePlayer,
    'id' | 'username' | 'avatar' | 'currentGameId' | 'isGuest' | 'isOwner'
  >
  type Game = Omit<FullGame, 'players'> & { players?: LightPlayer[] }
  type LightGame = Pick<Game, 'id' | 'created' | 'kind' | 'players' | 'locales'>
  type GameOrGameParameters =
    | Game
    | (Pick<
        GameParameters,
        | 'schemaString'
        | 'error'
        | 'id'
        | 'kind'
        | 'preferences'
        | 'rulesBookPageCount'
        | 'availableSeats'
        | 'colors'
      > & { players?: LightPlayer[] })
  const createGame: TypedDocumentNode<{ createGame: LightGame }, CreateGameArgs>
  const deleteGame: TypedDocumentNode<
    { deleteGame: Pick<Game, 'id'> },
    DeleteGameArgs
  >
  const invite: TypedDocumentNode<{ invite: Pick<Game, 'id'> }, InviteArgs>
  const kick: TypedDocumentNode<{ kick: Pick<Game, 'id'> }, KickArgs>
  const listGames: TypedDocumentNode<{ listGames: LightGame[] }>
  const receiveGameListUpdates: TypedDocumentNode<{
    receiveGameListUpdates: LightGame[]
  }>
  const receiveGameUpdates: TypedDocumentNode<
    {
      receiveGameUpdates: Game
    },
    ReceiveGameUpdatesArgs
  >
  const promoteGame: TypedDocumentNode<
    {
      promoteGame: GameOrGameParameters
    },
    PromoteGameArgs
  >
  const joinGame: TypedDocumentNode<
    {
      joinGame: GameOrGameParameters
    },
    JoinGameArgs
  >
  const getGamePlayers: TypedDocumentNode<
    {
      joinGame: { players: LightPlayer[] }
    },
    { id: JoinGameArgs['gameId'] }
  >
  const saveGame: TypedDocumentNode<
    {
      saveGame: Pick<Game, 'id'>
    },
    SaveGameArgs
  >

  // players.graphql
  type PlayerFragment = Pick<Player, 'id' | 'username' | 'avatar'>
  type PlayerWithSearchable = PlayerFragment &
    Pick<Player, 'usernameSearchable'>
  type PlayerWithTurnCredentials = FullPlayerWithTurnCredentials
  type FullPlayer = Player
  type Friendship = { player: PlayerFragment } & Pick<
    FullFriendship,
    'isProposal' | 'isRequest'
  >
  type FriendshipUpdate = { from: PlayerFragment } & Pick<
    FullFriendshipUpdate,
    'accepted' | 'declined' | 'proposed' | 'requested'
  >

  const acceptFriendship: TypedDocumentNode<
    { acceptFriendship: void },
    TargetedPlayerArgs
  >
  const acceptTerms: TypedDocumentNode<{
    acceptTerms: PlayerWithTurnCredentials['player']
  }>
  const endFriendship: TypedDocumentNode<
    { endFriendship: void },
    TargetedPlayerArgs
  >
  const getCurrentPlayer: TypedDocumentNode<{
    getCurrentPlayer: DeepRequired<PlayerWithTurnCredentials>
  }>
  const listFriends: TypedDocumentNode<{ listFriends: Friendship[] }>
  const logIn: TypedDocumentNode<
    { logIn: DeepRequired<PlayerWithTurnCredentials> },
    LogInArgs
  >
  const receiveFriendshipUpdates: TypedDocumentNode<{
    receiveFriendshipUpdates: FriendshipUpdate
  }>
  const requestFriendship: TypedDocumentNode<
    { requestFriendship: void },
    TargetedPlayerArgs
  >
  const searchPlayers: TypedDocumentNode<
    { searchPlayers: PlayerFragment[] },
    Pick<SearchPlayersArgs, 'search'>
  >
  const setUsernameSearchability: TypedDocumentNode<
    { setUsernameSearchability: PlayerWithSearchable },
    { searchable: boolean }
  >
  const updateCurrentPlayer: TypedDocumentNode<
    { updateCurrentPlayer: PlayerWithSearchable },
    Pick<UpdateCurrentPlayerArgs, 'avatar' | 'username'>
  >

  // signals.graphql
  const awaitSignal: TypedDocumentNode<{ awaitSignal: Signal }, AwaitSignalArgs>
  const sendSignal: TypedDocumentNode<
    { sendSignal: Pick<Signal, 'from'> },
    SendSignalArgs
  >
}
