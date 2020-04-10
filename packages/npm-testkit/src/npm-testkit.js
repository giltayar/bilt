'use strict'
const os = require('os')
const fs = require('fs')
const {promisify} = require('util')
const {default: startVerdaccio} = require('verdaccio')
const getPort = require('get-port')

/**@type {(
 * options: {
 *  logLevel?: 'http' | 'trace' | 'warn' | 'error' | 'info',
 *  shouldDeleteNpmRegistryEnvVars?: boolean
 * }) =>
 * Promise<{
 * registry: string
 * close: () => Promise<void>
 * }>} */
async function startNpmRegistry({logLevel = 'http', shouldDeleteNpmRegistryEnvVars = true} = {}) {
  const storageDir = await fs.promises.mkdtemp(os.tmpdir() + '/')
  const port = await getPort()

  const webserver = await new Promise((resolve) =>
    startVerdaccio(makeConfig(storageDir, logLevel), port, '', '', '', (webserver) =>
      resolve(webserver),
    ),
  )
  await new Promise((resolve, reject) =>
    webserver.listen(port, 'localhost', (err) => (err ? reject(err) : resolve())),
  )

  if (shouldDeleteNpmRegistryEnvVars) {
    // when running under `npm test` or any other npm script, npm will
    // set many environment variables, including `npm_config_registry`, that will override
    // any `.npmrc` file anywhere. This screws the testing.
    delete process.env.npm_config_registry
  }

  return {
    registry: `http://localhost:${port}`,
    async close() {
      await promisify(webserver.close.bind(webserver))()
    },
  }
}

const makeConfig = (storage, logLevel) => ({
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
      level: logLevel,
    },
  ],
  middlewares: {
    audit: {
      enabled: true,
    },
  },
  self_path: '/foo/bar',
})

module.exports = {
  startNpmRegistry,
}
