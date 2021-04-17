import {
  action,
  applyAction,
  loadScene,
  movePeerPointer,
  pointer,
  serializeScene
} from './engine'
import { lastConnected, lastMessageReceived, send } from './communication'

lastMessageReceived.subscribe(data => {
  if (data?.pointer) {
    movePeerPointer(data)
  } else if (data?.meshId) {
    applyAction(data)
  } else if (data?.scene) {
    loadScene(data.scene)
  }
})

lastConnected.subscribe(connection => {
  send({ scene: serializeScene() }, connection)
})

action.subscribe(send)
pointer.subscribe(send)
