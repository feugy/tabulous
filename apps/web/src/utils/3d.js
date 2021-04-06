import { groundToScreen } from '../3d/utils/vector'

export function getMeshCoordinates(mesh) {
  return groundToScreen(mesh.absolutePosition, mesh.getScene())
}
