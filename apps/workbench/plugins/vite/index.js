import { resolve } from 'path'
import { createReadStream } from 'fs'
import { readdir } from 'fs/promises'
import sirv from 'sirv'

const pluginName = 'vite-plugin-workbench'

const defaultOptions = {
  path: './workbench',
  url: '/workbench',
  toolRegexp: '\\.tools\\.svelte$',
  workframeHtml: resolve(__dirname, 'workframe.html'),
  workframeId: '@workbench/client',
  setupPath: null
}

async function findTools(path, detectionRegex) {
  const paths = []
  for (const entry of await readdir(path, {
    withFileTypes: true
  })) {
    const { name } = entry
    const fullname = resolve(path, name)
    if (entry.isFile() && detectionRegex.test(fullname)) {
      paths.push(fullname)
    } else if (entry.isDirectory()) {
      paths.push(...(await findTools(fullname, detectionRegex)))
    }
  }
  return paths
}

function buildWorkframe(paths, setupPath) {
  const tools = new Array(paths.length)
  const imports = new Array(paths.length)
  let i = 0
  for (const path of paths) {
    imports[i] = `import tool${i + 1} from '${path}'`
    tools[i] = `tool${++i}`
  }
  return `import { Workbench } from '@tabulous/workbench/src/workbench'
${setupPath ? `import '${setupPath}'` : ''}
${imports.join('\n')}

new Workbench({ 
  target: document.body, 
  props: { tools: [${tools.join(', ')}] }
})`
}

export default function WorkbenchPlugin(pluginOptions = {}) {
  const options = { ...defaultOptions, ...pluginOptions }
  if (!options.path) {
    throw new Error(`${pluginName} requires 'path' option`)
  }

  let workframeContent

  return {
    name: pluginName,

    apply: 'serve',

    async configureServer(server) {
      // automatically generates index
      const paths = await findTools(
        options.path,
        new RegExp(options.toolRegexp, 'i')
      )
      workframeContent = buildWorkframe(paths, options.setupPath)

      const hasTrailingUrl = options.url.endsWith('/')

      const serve = sirv(resolve(__dirname, '..', '..', 'dist'), { etag: true })

      // configure a middleware for serving the workbench
      server.middlewares.use(options.url, (req, res, next) => {
        if (req.url === `/workframe.html`) {
          // serve our workframe.html for the iframe
          res.writeHead(200, {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/html'
          })
          createReadStream(options.workframeHtml).pipe(res)
        } else if (!hasTrailingUrl && req.originalUrl === options.url) {
          // append trailing slash to allows resolving <script /> with relative sources
          res.statusCode = 301
          res.setHeader('Location', `${options.url}/`)
          res.end()
        } else {
          // all other static workbench assets
          serve(req, res, next)
        }
      })
    },

    resolveId(id) {
      if (id === options.workframeId) {
        return id
      }
    },

    load(id) {
      if (id === `${options.url}/${options.workframeId}`) {
        return workframeContent
      }
    }
  }
}
