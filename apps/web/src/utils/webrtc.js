// @ts-check
/**
 * @typedef {object} Constraints
 * @property {number} constraints.bitrate - maximum bitrate applied, in Kbps.
 */

/**
 * Builds a transform function to applies various customization to the WebRTC SDP payload, such as bitrate limitation.
 * @param {Constraints} constraints - applied constraints.
 * @returns {(sdp: string) => string} the transform function, that takes SDP payload as parameter and returns an altered version.
 * @see https://webrtchacks.com/limit-webrtc-bandwidth-sdp/
 */
export function buildSDPTransform(constraints) {
  return sdp => {
    const claims = sdp.split('\n')
    const context = {}
    initContextForBitrate(context, constraints)
    for (let rank = 0; rank < claims.length; rank++) {
      rank = applyBitrateLimit({ claims, rank, context })
    }
    return claims.join('\n')
  }
}

/**
 * @param {?} context - contextual object
 * @param {Constraints} constraints - applied constraints.
 */
function initContextForBitrate(context, { bitrate }) {
  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox')
  // we can not modifiy JSDom useragent on the fly, so we only test the default case
  /* istanbul ignore next */
  context.bitrateClaim = isFirefox
    ? `b=TIAS:${bitrate * 1000}`
    : `b=AS:${bitrate}`
  context.inMedia = false
}

/**
 * @param {object} args
 * @param {string[]} args.claims - an array of SDP claims.
 * @param {number} args.rank - current claim rank.
 * @param {?} args.context - contextual data.
 * @returns {number} rank of the analyzed claim.
 */
function applyBitrateLimit({ claims, rank, context }) {
  if (context.bitrateClaim) {
    const claim = claims[rank]
    if (claim.startsWith('m=video')) {
      context.inMedia = true
    } else if (claim.startsWith('m=')) {
      context.inMedia = false
    }

    if (context.inMedia) {
      if (claim.startsWith('b=')) {
        claims[rank] = context.bitrateClaim
        context.bitrateClaim = undefined
      } else if (claim.startsWith('a=')) {
        claims.splice(rank, 0, context.bitrateClaim)
        context.bitrateClaim = undefined
        rank++
      }
    }
  }
  return rank
}
