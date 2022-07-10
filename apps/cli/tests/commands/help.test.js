import { help } from '../../src/commands/help.js'
import { mockConsole } from '../test-util.js'

describe('help command', () => {
  const output = mockConsole()

  it('prints help on console', () => {
    help()
    expect(output.stdout).toContain(`
  tabulous [options] <command>
  Commands:
    catalog                   List accessible game
    grant [game-name]         Grant access to a copyright game
    revoke [game-name]        Revoke access to a copyright game
  Options:
    --help/-h                 Display help for a given command or subcommand
    --username/-u             Username for which command is run
    --production/-p           Load configuration from .env.local
`)
  })
})
