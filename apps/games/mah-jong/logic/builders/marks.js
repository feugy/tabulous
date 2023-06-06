import { shapes } from '../constants.js'

export function buildDealerMark() {
  return {
    id: 'dealer-mark',
    shape: 'roundedTile',
    texture: 'dealer-mark.ktx2',
    ...shapes.dealerMark,
    y: shapes.dealerMark.height * 0.5,
    z: -3,
    detailable: {
      frontImage: `dealer-mark-front.svg`,
      backImage: `dealer-mark-back.svg`
    },
    movable: { kind: 'dealer' },
    flippable: {},
    rotable: {}
  }
}
