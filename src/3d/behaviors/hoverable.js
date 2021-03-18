import { multiSelectionManager } from '../managers'

export class HoverBehavior {
  constructor() {
    this.mesh = null
    this.enabled = true
  }

  get name() {
    return HoverBehavior.NAME
  }

  init() {}

  attach(mesh) {
    if (!this.mesh) {
      this.mesh = mesh
      this.enabled = true
      multiSelectionManager.registerHoverable(this)
    }
  }

  detach() {
    multiSelectionManager.unregisterHoverable(this)
    this.mesh = null
  }
}

HoverBehavior.NAME = 'hoverable'
