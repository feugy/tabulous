import { createServer } from 'net'
import { makeLogger } from '../src/utils/logger'

export function mockLogger(name) {
  const logger = makeLogger(name)
  const noop = () => {}
  return {
    trace: jest.spyOn(logger, 'trace').mockImplementation(noop),
    debug: jest.spyOn(logger, 'debug').mockImplementation(noop),
    log: jest.spyOn(logger, 'log').mockImplementation(noop),
    info: jest.spyOn(logger, 'info').mockImplementation(noop),
    warn: jest.spyOn(logger, 'warn').mockImplementation(noop),
    error: jest.spyOn(logger, 'error') // .mockImplementation(noop)
  }
}

export async function isPortFree(port) {
  return new Promise(function (resolve, reject) {
    const server = createServer()
    server.once('error', function (err) {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        reject(new Error('port in use'))
      }
    })
    server.once('listening', function () {
      server.once('close', function () {
        resolve(port)
      })
      server.close()
    })
    server.listen(port)
  })
}
