import stripAnsi from 'strip-ansi'
import { describe, expect, it } from 'vitest'

import { help } from '../../src/commands/help.js'

describe('help command', () => {
  it('prints help on console', () => {
    expect(stripAnsi(help())).toContain(`
  tabulous [options] <command>
  Commands:
    add-player                Creates a new player account
    catalog                   Lists accessible games
    grant [game-name]         Grants access to a copyrighted game
    revoke [game-name]        Revokes access to a copyrighted game
    show-player               Show details for a given player
  Common options:
    --username/-u             Username for which command is run
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for a given command
`)
  })
})
