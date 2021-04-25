import { logIn } from '../services/index.js'

export default {
  Mutation: {
    logIn: async (_, { username }) => logIn(username)
  }
}
