import {tmpdir} from 'os'
import {promises, existsSync} from 'fs'
import {join} from 'path'
import {promisify} from 'util'
import verdaccio from 'verdaccio'
const {default: startVerdaccio} = verdaccio
import getPort from 'get-port'
import NpmRegistryClient from 'npm-registry-client'
import {writeFile, readFileAsString} from '@bilt/scripting-commons'

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
export async function startNpmRegistry({
  logLevel = 'error',
  shouldDeleteNpmRegistryEnvVars = true,
  shouldProxyToNpmJs = false,
} = {}) {
  const storageDir = await promises.mkdtemp(tmpdir() + '/')
  const port = await getPort()

  const webserver = await new Promise((resolve) =>
    startVerdaccio(
      makeConfig(storageDir, logLevel, shouldProxyToNpmJs),
      port,
      '',
      '',
      '',
      /**
       * @param {any} webserver
       */ (webserver) => resolve(webserver),
    ),
  )
  await new Promise((resolve, reject) =>
    webserver.listen(
      port,
      'localhost',
      /**
       * @param {any} err
       */ (err) => (err ? reject(err) : resolve(undefined)),
    ),
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
 * @param {string} [scope]
 */
export async function enablePackageToPublishToRegistry(packageDir, registry, scope) {
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
      /**
       * @param {Error | null} err
       * @param {any} _data
       * @param {any} raw
       */ (err, _data, raw) => (err ? reject(err) : resolve(raw)),
    )
  })
  await writeFile(
    '.npmrc',
    (existsSync(join(packageDir, '.npmrc'))
      ? await readFileAsString('.npmrc', {cwd: packageDir})
      : '') +
      `
  //${new URL(registry).host}/:_authToken=${JSON.parse(x).token}
  registry=${registry}
  ${scope ? `@${scope}:registry=${registry}` : ''}
  `,
    {cwd: packageDir},
  )
}

/**
 * @param {string} storage
 * @param {string} logLevel
 * @param {boolean} shouldProxyToNpmJs
 */
const makeConfig = (storage, logLevel, shouldProxyToNpmJs) => ({
  storage,
  uplinks: {
    npmjs: {
      url: 'https://registry.npmjs.org/',
    },
  },
  auth: {
    htpasswd: {
      file: join(storage, './htpasswd'),
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
