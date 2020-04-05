'use strict'
const os = require('os')
const fs = require('fs')
const {promisify} = require('util')
const {default: startVerdaccio} = require('verdaccio')
const getPort = require('get-port')

/**@returns {Promise<{
 * registry: string
 * close: () => Promise<void>
 * }>} registry */
async function startNpmRegistry() {
  const storageDir = await fs.promises.mkdtemp(os.tmpdir() + '/')
  const port = await getPort()

  const webserver = await new Promise((resolve) =>
    startVerdaccio(makeConfig(storageDir), port, '', '', '', (webserver) => resolve(webserver)),
  )
  await new Promise((resolve, reject) =>
    webserver.listen(port, 'localhost', (err) => (err ? reject(err) : resolve())),
  )

  return {
    registry: `http://localhost:${port}`,
    async close() {
      await promisify(webserver.close.bind(webserver))()
    },
  }
}

const makeConfig = (storage) => ({
  storage,
  uplinks: {
    npmjs: {
      url: 'https://registry.npmjs.org/',
    },
  },
  auth: {
    htpasswd: {
      file: require('path').join(storage, './htpasswd'),
    },
  },
  packages: {
    '@*/*': {
      access: '$anonymous',
      publish: '$anonymous',
    },
    '**': {
      access: '$anonymous',
      publish: '$anonymous',
    },
  },
  logs: [
    {
      type: 'stdout',
      format: 'pretty',
      level: 'trace',
    },
  ],
  self_path: '/foo/bar',
})

module.exports = {
  startNpmRegistry,
}
