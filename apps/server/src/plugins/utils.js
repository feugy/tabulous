import { getPlayerById } from '../services/index.js'

export async function getAuthenticatedPlayer(token) {
  let player = null
  if (token) {
    const id = token.replace('Bearer ', '')
    player = await getPlayerById(id)
  }
  return player
}
