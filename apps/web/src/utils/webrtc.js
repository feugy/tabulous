/**
 * Builds a transform function to applies various customization to the WebRTC SDP payload, such as bitrate limitation.
 * @param {object} constraints - applied constraints, including:
 * @param {number} constraints.bitrate - maximum bitrate applied, in Kbps.
 * @returns {function} the transform function, that takes SDP payload as parameter and returns an altered version.
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

function initContextForBitrate(context, { bitrate }) {
  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox')
  // we can not modifiy JSDom useragent on the fly, so we only test the default case
  /* istanbul ignore next */
  context.bitrateClaim = isFirefox
    ? `b=TIAS:${bitrate * 1000}`
    : `b=AS:${bitrate}`
  context.inMedia = false
}

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
