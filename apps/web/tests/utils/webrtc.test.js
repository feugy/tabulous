import { faker } from '@faker-js/faker'

import { buildSDPTransform } from '../../src/utils'

describe('webRTC utilities', () => {
  const bitrate = faker.datatype.number()
  const claim = `b=AS:${bitrate}`

  describe('buildSDPTransform()', () => {
    const transform = buildSDPTransform({ bitrate })

    it('handles empty input', () => {
      expect(transform(``)).toEqual(``)
    })

    it('can insert bitrate limitation', () => {
      expect(
        transform(`
m=video 60372 UDP/TLS/RTP/SAVPF 100 101 116 117 96
c=IN IP4 217.130.243.155
a=rtcp:64891 IN IP4 217.130.243.155
`)
      ).toEqual(`
m=video 60372 UDP/TLS/RTP/SAVPF 100 101 116 117 96
c=IN IP4 217.130.243.155
${claim}
a=rtcp:64891 IN IP4 217.130.243.155
`)
    })

    it('can replace existing bitrate limitation', () => {
      expect(
        transform(`
m=video 60372 UDP/TLS/RTP/SAVPF 100 101 116 117 96
c=IN IP4 217.130.243.155
b=AS:256
a=rtcp:64891 IN IP4 217.130.243.155
`)
      ).toEqual(`
m=video 60372 UDP/TLS/RTP/SAVPF 100 101 116 117 96
c=IN IP4 217.130.243.155
${claim}
a=rtcp:64891 IN IP4 217.130.243.155
`)
    })

    it('ignores audio lines', () => {
      expect(
        transform(`
m=audio 58779 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 126
c=IN IP4 217.130.243.155
a=rtcp:51472 IN IP4 217.130.243.155
m=video 60372 UDP/TLS/RTP/SAVPF 100 101 116 117 96
c=IN IP4 217.130.243.155
a=rtcp:64891 IN IP4 217.130.243.155
m=video 60372 UDP/TLS/RTP/SAVPF 100 101 116 117 96
c=IN IP4 217.130.243.155
a=rtcp:64891 IN IP4 217.130.243.155
`)
      ).toEqual(`
m=audio 58779 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 126
c=IN IP4 217.130.243.155
a=rtcp:51472 IN IP4 217.130.243.155
m=video 60372 UDP/TLS/RTP/SAVPF 100 101 116 117 96
c=IN IP4 217.130.243.155
${claim}
a=rtcp:64891 IN IP4 217.130.243.155
m=video 60372 UDP/TLS/RTP/SAVPF 100 101 116 117 96
c=IN IP4 217.130.243.155
a=rtcp:64891 IN IP4 217.130.243.155
`)
    })
  })
})
