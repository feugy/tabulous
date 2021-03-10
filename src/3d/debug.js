import Babylon from 'babylonjs'
const { Color3, DynamicTexture, Mesh, StandardMaterial, Vector3 } = Babylon

export function showAxis(size) {
  function makeTextPlane(text, color, size) {
    const dynamicTexture = new DynamicTexture('DynamicTexture', 50)
    dynamicTexture.hasAlpha = true
    dynamicTexture.drawText(
      text,
      5,
      40,
      'bold 36px Arial',
      color,
      'transparent',
      true
    )
    const plane = new Mesh.CreatePlane('TextPlane', size)
    plane.material = new StandardMaterial('TextPlaneMaterial')
    plane.material.backFaceCulling = false
    plane.material.specularColor = new Color3(0, 0, 0)
    plane.material.diffuseTexture = dynamicTexture
    return plane
  }

  const axis = {
    x: Mesh.CreateLines('axisX', [
      new Vector3.Zero(),
      new Vector3(size, 0, 0),
      new Vector3(size * 0.95, 0.05 * size, 0),
      new Vector3(size, 0, 0),
      new Vector3(size * 0.95, -0.05 * size, 0)
    ]),
    y: Mesh.CreateLines('axisY', [
      new Vector3.Zero(),
      new Vector3(0, size, 0),
      new Vector3(-0.05 * size, size * 0.95, 0),
      new Vector3(0, size, 0),
      new Vector3(0.05 * size, size * 0.95, 0)
    ]),
    z: Mesh.CreateLines('axisZ', [
      new Vector3.Zero(),
      new Vector3(0, 0, size),
      new Vector3(0, -0.05 * size, size * 0.95),
      new Vector3(0, 0, size),
      new Vector3(0, 0.05 * size, size * 0.95)
    ])
  }
  axis.x.color = new Color3(1, 0, 0)
  axis.y.color = new Color3(0, 1, 0)
  axis.z.color = new Color3(0, 0, 1)
  const chars = {
    x: makeTextPlane('X', 'red', size / 10),
    y: makeTextPlane('Y', 'green', size / 10),
    z: makeTextPlane('Z', 'blue', size / 10)
  }
  chars.x.position = new Vector3(0.9 * size, 0.05 * size, 0)
  chars.y.position = new Vector3(0, 0.9 * size, 0.05 * size)
  chars.z.position = new Vector3(0, 0.05 * size, 0.9 * size)
  return { chars, axis }
}
