# TODO

## Refactor

- engine should be global, not subscribable
- decouple communication channel from game logic
- disable any possible action while animating

## Single player

- ust CTRL for changing multiple selection
- parametrize and serialize UVs
- ability to shuffle stack on scene loading
- camera controls
- zoom on item
- permanently shows stack size?
- stack actions:
  - draw multiple cards (either in hand, or in front of them)
  - distribute multiple cards to players (either in their hand, or in front of them)
  - add to bottom
- boards

## Multi player

- player name
- table creation
- inline video

# Known issues

- menu does not disappear after action
- multi selection does not always work fine
- flip stacked items only flip individual card: it does not change the ordering
- flipping or rotating item does not change vertical position: items above it will still be above it at the end
- moving items bellow other does not apply gravity to them
- peer lost on reload > store in session/local storage?
- some actions are lost over the wire, or not applied, like quick multiple rotations
- need to synchronise actions over the wire (like flipping overlapping cards)
- peer pointer remains after peer is gone

# Notes

In Tabletopia, the interaction model is:

- left drag the board to pan
- right drag the board to control camera angle
- molette to zoom in and out
- left drag an item to move (clear previous selection unless clicking a selected item)
- left left click to select (clear previous selection)
- double click to zoom (only on cards)
- right click to display action menu (clear previous selection unless clicking a selected item)
- drag + left click to select multiple
- shift + left click to add (or remove) to the multiple selection
- keyboard shortcut to trigger actions on current selection

Being forced to do click (either select or menu) before triggering actions (shortcut or menu) is a bummer

Game setup

- min/max number of players allowed
- players' positions
- token/card enabled behaviors (overall+per item setting?)
- personnal hand support (impact on the draw and distribute commands)

Ideas for UI:

- top right, an help button with drawing for base commands (pan, camera, DnD, main actions)
- top right, an link to the rule book, opened in a floating pane, either taking whole screen, or a third of it
- top left, in a column, player avatars/videos, with number of tokens/cards in hand, and mute indicator & command
- bottom left, chat window
- bottom, expansible area showing player's hand

Ideas for joining a game:

- new player should wait in a loby until another player let them in
- joining player are assigned to a slot, that will remain even if player disconnects
- any player can mute, or kick, another player (really?)

# Various learnings

Physics engine aren't great: they are all pretty deprecated. [Cannon-es can not be used yet](https://github.com/BabylonJS/Babylon.js/issues/9810).
When stacked, card are always bouncing.

Polygon extrusion does not support path (for curves like rounded corners), and the resulting mesh is not vertically (Y axis) centered
