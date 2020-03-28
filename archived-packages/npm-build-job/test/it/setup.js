'use strict'
const {promisify: p} = require('util')
const os = require('os')
const fs = require('fs')
const path = require('path')
const {dockerComposeTool, getAddressForService} = require('docker-compose-mocha')
const {executeCommand} = require('@bilt/host-agent')

function setup(before, after) {
  const pathToCompose = path.join(__dirname, 'docker-compose.yml')

  const envName = dockerComposeTool(before, after, pathToCompose, {
    shouldPullImages: (process.env.NODE_ENV || 'development') !== 'development',
    brutallyKill: true,
  })

  before(async () => {
    const npmRegistryAddress = await getAddressForService(
      envName,
      pathToCompose,
      'npm-registry',
      4873,
    )

    process.env.NPM_CONFIG_REGISTRY = `http://${npmRegistryAddress}`
  })

  after(() => {
    delete process.env.NPM_CONFIG_REGISTRY
  })

  return {
    async setupPackage(packageDir, {shouldPublish = true}) {
      const dir = await createPackage(packageDir)

      await p(fs.writeFile)(
        path.join(dir, '.npmrc'),
        `${process.env.NPM_CONFIG_REGISTRY.replace(
          'http:',
          '',
        )}/:_authToken="dummy-token-because-npm-needs-to-have-one-even-foranonymous-publishing"`,
      )
      const packageJson = JSON.parse(await p(fs.readFile)(path.join(dir, 'package.json')))

      if (shouldPublish) {
        await publishPackage(dir)
      }

      return {dir, packageJson}
    },
  }
}

async function createPackage(packageDir) {
  const tmpDir = await p(fs.mkdtemp)(os.tmpdir() + '/')

  await p(fs.copyFile)(
    path.join(__dirname, packageDir, 'package.json'),
    path.join(tmpDir, 'package.json'),
  )
  await p(fs.copyFile)(
    path.join(__dirname, packageDir, 'package-lock.json'),
    path.join(tmpDir, 'package-lock.json'),
  )

  return tmpDir
}

async function publishPackage(dir) {
  await executeCommand({
    command: ['npm', 'publish'],
    cwd: dir,
  })
}

module.exports = setup
