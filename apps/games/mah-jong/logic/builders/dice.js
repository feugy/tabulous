export function buildDice() {
  const dices = []
  const diameter = 0.6
  for (let rank = 1; rank <= 2; rank++) {
    dices.push({
      shape: 'die',
      id: `d6-${rank}`,
      faces: 6,
      texture: `/assets/textures/die-6.1.ktx2`,
      diameter,
      x: (rank === 1 ? -1.2 : 1.2) * diameter,
      y: diameter,
      z: 0,
      movable: {},
      randomizable: {}
    })
  }
  return dices
}
