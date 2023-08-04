// @ts-check
/** @typedef {import('../services/games').GameData} _Game */
/** @typedef {import('../services/games').GameParameters} _GameParameters */

/**
 * Generated from catalog.graphql
 * @typedef {Pick<import('../services/catalog.js').GameDescriptor, 'name'|'locales'> & Partial<Pick<import('../services/catalog').GameDescriptor, 'copyright'|'minSeats'|'maxSeats'|'minAge'|'maxAge'|'minTime'>>} CatalogItem
 *
 * @typedef {import('../services/catalog').Copyright} Copyright
 * @typedef {import('../services/catalog').TableSpec} TableSpec
 * @typedef {import('../services/catalog').ZoomSpec} ZoomSpec
 * @typedef {import('../services/catalog').ColorSpec} ColorSpec
 * @typedef {import('../services/catalog').ActionSpec} ActionSpec
 * @typedef {keyof ActionSpec} ButtonName
 * @typedef {import('../services/catalog').ActionName} ActionName
 * @typedef {import('../services/catalog').ItemLocale} ItemLocale
 * @typedef {import('../services/catalog').ItemLocales} ItemLocales
 *
 * @typedef {object} GrantAccessArgs
 * @property {string} playerId - player id being granted access.
 * @property {string} itemName - granted catalog item name.
 *
 * @typedef {object} RevokeAccessArgs
 * @property {string} playerId - player id being granted access.
 * @property {string} itemName - granted catalog item name.
 */

/**
 * Generated from games.graphql
 * @typedef {import('../services/players').Player & { isGuest?: boolean, isOwner?: boolean }} GamePlayer
 *
 * @typedef {Pick<_Game, 'id'|'created'|'kind'|'rulesBookPageCount'|'zoomSpec'|'tableSpec'|'colors'|'actions'> & Partial<Pick<_Game, 'messages'|'locales'|'meshes'|'cameras'|'hands'|'preferences'|'availableSeats'>> & { players?: GamePlayer[]}} Game
 *
 * @typedef {import('../services/games').Shape} Shape
 * @typedef {import('../services/games').Mesh} Mesh
 * @typedef {import('../services/games').InitialTransform} InitialTransform
 * @typedef {import('../services/games').DetailableState} DetailableState
 * @typedef {import('../services/games').FlippableState} FlippableState
 * @typedef {import('../services/games').RotableState} RotableState
 * @typedef {import('../services/games').MovableState} MovableState
 * @typedef {import('../services/games').StackableState} StackableState
 * @typedef {import('../services/games').AnchorableState} AnchorableState
 * @typedef {import('../services/games').DrawableState} DrawableState
 * @typedef {import('../services/games').LockableState} LockableState
 * @typedef {import('../services/games').QuantifiableState} QuantifiableState
 * @typedef {import('../services/games').RandomizableState} RandomizableState
 * @typedef {import('../services/games').Anchor} Anchor
 * @typedef {import('../services/games').Point} Point
 * @typedef {import('../services/games').Dimension} Dimension
 * @typedef {import('../services/games').Targetable} Targetable
 * @typedef {import('../services/games').PlayerPreference} PlayerPreference
 * @typedef {import('../services/games').Message} Message
 * @typedef {import('../services/games').CameraPosition} CameraPosition
 * @typedef {import('../services/games').Hand} Hand
 *
 * @typedef {Pick<_GameParameters, 'error'|'id'|'kind'> & Partial<Pick<_GameParameters, 'locales'|'preferences'|'rulesBookPageCount'|'availableSeats'|'colors'>> & { schemaString?: string, players?: GamePlayer[]}} GameParameters
 *
 * @typedef {object} CreateGameArgs
 * @property {string} [kind] - created game kind (omit to create a lobby).
 *
 * @typedef {object} JoinGameArgs
 * @property {string} gameId - joined game's id.
 * @property {string} [parameters] -player's provided parameters in a stringified object.
 *
 * @typedef {object} PromoteGameArgs
 * @property {string} gameId - promoted game's id.
 * @property {string} kind - promoted game kind.
 *
 * @typedef {object} SaveGameArgs
 * @property {Pick<Game, 'id'|'meshes'|'messages'|'cameras'|'hands'>} game - saved game data
 *
 * @typedef {object} DeleteGameArgs
 * @property {string} gameId - deleted game's id.
 *
 * @typedef {object} InviteArgs
 * @property {string} gameId - game's id.
 * @property {string[]} playerIds - invited player ids.
 *
 * @typedef {object} KickArgs
 * @property {string} gameId - game's id.
 * @property {string} playerId - kicked player id.
 *
 * @typedef {object} ReceiveGameUpdatesArgs
 * @property {string} gameId - game's id.
 */

/**
 * From logger.graphql LoggerLevel and InputLoggerLevel
 * @typedef {object} LoggerLevel
 * @property {string} name - logger name.
 * @property {import('../utils/logger').Level} level - current log level.
 */

/**
 * Generated from players.graphql
 * @typedef {Pick<import('../services/players.js').Player, 'id'|'username'> & Partial<Pick<import('../services/players').Player, 'currentGameId'|'avatar'|'provider'|'email'|'termsAccepted'|'isAdmin'|'usernameSearchable'>>} Player
 *
 * @typedef {{ player: Player } & Pick<import('../services/players').Friendship, 'isRequest'|'isProposal'> } Friendship
 *
 * @typedef {{ from: Player } & Pick<import('../services/players').FriendshipUpdate, 'requested'|'proposed'|'accepted'|'declined'> } FriendshipUpdate
 *
 * @typedef {import('../services/turn-credentials').TurnCredentials} TurnCredentials
 *
 * @typedef {object} PlayerWithTurnCredentials
 * @property {string} token - authentication token.
 * @property {Player} player - authenticated player.
 * @property {TurnCredentials} turnCredentials - credentials for the TURN server.
 *
 * @typedef {object} SearchPlayersArgs
 * @property {string} search - searched text.
 * @property {boolean} [includeCurrent] - whether to include current player in results or not.
 *
 * @typedef {object} ListPlayersArgs
 * @property {number} [from] - index of the first result returned.
 * @property {number} [size] - number of return results.
 *
 * @typedef {object} AddPlayerArgs
 * @property {string} id - created player id.
 * @property {string} username - created player username.
 * @property {string} password - created player password (clear value).
 *
 * @typedef {object} LogInArgs
 * @property {string} id - user account id.
 * @property {string} password - clear password.
 *
 * @typedef {object} UpdateCurrentPlayerArgs
 * @property {string} [username] - new username value, if any.
 * @property {string} [avatar] - new avatar value, if any.
 * @property {boolean} [usernameSearchable] - new value for username searchability, if any.
 *
 * @typedef {object} TargetedPlayerArgs - for deletePlayer, sendFriendRequest, requestFriendship, acceptFriendship, endFriendship mutations
 * @property {string} id - id of the targeted player.
 */

/**
 * Generated from signal.graphql
 *
 * @typedef {object} Signal
 * @property {string} from - player id sending this signal.
 * @property {string} data - the signal payload.
 *
 * @typedef {object} SendSignalArgs
 * @property {{ to: string, data: string }} signal - player id to which the signal is sent and the signal payload.
 *
 * @typedef {object} AwaitSignalArgs
 * @property {string} gameId - game's id.
 */

export default void 0
