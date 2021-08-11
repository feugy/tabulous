import { filter, map } from 'rxjs/operators'
import { invites, getPlayerById } from '../services/index.js'

function serialize(chunk) {
  const payload = []
  if (chunk.event) {
    payload.push(`event: ${chunk.event}`)
  }
  if (chunk.data) {
    payload.push(`data: ${JSON.stringify(chunk.data)}`)
  }
  if (chunk.retry) {
    payload.push(`retry: ${chunk.retry}`)
  }
  payload.push('', '')
  return payload.join('\n')
}

function makeDecorator(retry) {
  return function replySSE(observable) {
    const headers = this.getHeaders()
    for (const key in headers) {
      this.raw.setHeader(key, headers[key])
    }
    this.raw.setHeader('Content-Type', 'text/event-stream')
    this.raw.setHeader('Connection', 'keep-alive')
    this.raw.setHeader('Cache-Control', 'no-cache,no-transform')
    this.raw.setHeader('x-no-compression', 1)
    this.raw.write(serialize({ retry }))
    const subscription = observable.subscribe(
      value => this.raw.write(serialize(value)),
      error =>
        this.log.warn(
          { error },
          `SSE observable threw error: ${error.message}`
        ),
      () => this.raw.write(serialize({ event: 'end', data: 'Stream closed' }))
    )
    this.raw.on('close', () => subscription?.unsubscribe())
  }
}

/**
 * Registers Server-Sent Event endpoint into the provided fastify application.
 * Will send "invite" events to the guest player when they've been invited to a game
 * @param {fastify} app - a fastify application
 * @param {object} opts - plugin's options, including:
 * @param {string} opts.path - the sse endpoint path
 */
async function registerSSE(app, opts) {
  const retry = opts.retryDelay || 3000

  app.decorateReply('sse', makeDecorator(retry))

  app.get(opts.path, ({ query }, reply) => {
    getPlayerById(query.id).then(player => {
      if (player) {
        reply.sse(
          // sends an "invite" event to the appropriate guest
          invites.pipe(
            filter(({ guestId }) => guestId === player.id),
            map(data => ({ event: 'invite', data }))
          )
        )
      }
    })
  })
}

export default registerSSE
