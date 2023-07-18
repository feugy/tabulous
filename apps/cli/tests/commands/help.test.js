// @ts-check
import stripAnsi from 'strip-ansi'
import { describe, expect, it } from 'vitest'

import { help } from '../../src/commands/help.js'

describe('help command', () => {
  it('prints help on console', () => {
    expect(stripAnsi(help())).toContain(`
  tabulous [options] <command>
  Commands:
    list-players                List all existing player accounts
    add-player                  Creates a new player account
    show-player                 Show details for a given player
    catalog                     Lists accessible games
    configure-loggers [levels]  Changes loggers levels
    grant [game-name]           Grants access to a copyrighted game
    revoke [game-name]          Revokes access to a copyrighted game
    delete-game [game-id]       Deletes an existing game or lobby
    delete-player [player-id]   Deletes an existing player account
  Common options:
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
  })
})
