import stripAnsi from 'strip-ansi'
import { help } from '../../src/commands/help.js'

describe('help command', () => {
  it('prints help on console', () => {
    expect(stripAnsi(help())).toContain(`
  tabulous [options] <command>
  Commands:
    catalog                   Lists accessible games
    grant [game-name]         Grants access to a copyrighted game
    revoke [game-name]        Revokes access to a copyrighted game
  Options:
    --username/-u             Username for which command is run
    --production/-p           Loads configuration from .env.local
    --help/-h                 Displays help for a given command
`)
  })
})
