'use strict'
const os = require('os')
const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const {default: startVerdaccio} = require('verdaccio')
const getPort = require('get-port')
const NpmRegistryClient = require('npm-registry-client')
const {writeFile, readFileAsString} = require('@bilt/scripting-commons')

/**@type {(
 * options: {
 *  logLevel?: 'http' | 'trace' | 'warn' | 'error' | 'info',
 *  shouldDeleteNpmRegistryEnvVars?: boolean
 *  shouldProxyToNpmJs?: boolean
 * }) =>
 * Promise<{
 * registry: string
 * close: () => Promise<void>
 * }>} */
async function startNpmRegistry({
  logLevel = 'error',
  shouldDeleteNpmRegistryEnvVars = true,
  shouldProxyToNpmJs = false,
} = {}) {
  const storageDir = await fs.promises.mkdtemp(os.tmpdir() + '/')
  const port = await getPort()

  const webserver = await new Promise((resolve) =>
    startVerdaccio(
      makeConfig(storageDir, logLevel, shouldProxyToNpmJs),
      port,
      '',
      '',
      '',
      (webserver) => resolve(webserver),
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

/**
 *
 * @param {string} packageDir
 * @param {string} registry
 */
async function enablePackageToPublishToRegistry(packageDir, registry) {
  const x = await new Promise((resolve, reject) => {
    new NpmRegistryClient().adduser(
      registry,
      {
        auth: {
          username: 'whatever',
          password: 'whatever',
          email: 'whatever@example.com',
        },
      },
      /**@param {Error | null} err*/ (err, _data, raw) => (err ? reject(err) : resolve(raw)),
    )
  })
  await writeFile(
    '.npmrc',
    (fs.existsSync(path.join(packageDir, '.npmrc'))
      ? await readFileAsString('.npmrc', {cwd: packageDir})
      : '') +
      `
  registry=${registry}
  //${new URL(registry).host}/:_authToken=${JSON.parse(x).token}
  `,
    {cwd: packageDir},
  )
}

const makeConfig = (storage, logLevel, shouldProxyToNpmJs) => ({
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
      access: '$all',
      publish: '$all',
      proxy: shouldProxyToNpmJs ? ['npmjs'] : [],
    },
    '**': {
      access: '$all',
      publish: '$all',
      proxy: shouldProxyToNpmJs ? ['npmjs'] : [],
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
  enablePackageToPublishToRegistry,
}
