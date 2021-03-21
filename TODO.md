# TODO

## Refactor

- do not show action menu while animating

## Single player

- stack actions:
  - draw multiple cards
  - add to bottom
- camera controls
- tokens (stackable, flippable, rotable)
- boards
- game loading mechanism

## Multi player

- player name
- table creation
- inline video

# Known issues

- some actions are lost, or not applied, like quick multiple rotations
- peer pointer remains after peer is gone
- flip stack only flip individual card: it does not change the ordering
- card can leave the table
- camera can go wild

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
