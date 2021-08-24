import { logIn } from '../services/index.js'

export default {
  Mutation: {
    logIn: (_, { username }) => logIn(username)
  }
}
