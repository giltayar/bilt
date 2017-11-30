'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const path = require('path')
const os = require('os')
const {describe, it, before, after} = require('mocha')
const {expect} = require('chai')
const {dockerComposeTool, getAddressForService} = require('docker-compose-mocha')
const getNpmToken = require('get-npm-token')
const hostAgentService = require('@bildit/host-agent')
const pluginImport = require('plugin-import')
const npmCommanderService = require('@bildit/npm-commander')

const findNextVersion = require('../../src/find-next-version')

describe('findNextVersion', function() {
  const pathToCompose = path.join(__dirname, 'docker-compose.yaml')
  const envName = dockerComposeTool(before, after, pathToCompose, {
    shouldPullImages: (process.env.NODE_ENV || 'development') !== 'development',
    brutallyKill: true,
  })

  it('should find the next version of an existing package', async () => {
    const pimport = await createPimport(envName, pathToCompose, dir)

    const hostAgent = await pimport('host-agent')
    const agentInstance = await hostAgent.acquireInstanceForJob()

    const npmCommander = await pimport('npm-commander')
    const npmCommanderSetup = await npmCommander.setup({agentInstance})

    const dir = await createPackage()
    const packageJson = JSON.parse(await p(fs.readFile)(path.join(dir, 'package.json')))
    await publishPackage(dir, hostAgent, agentInstance, npmCommander, npmCommanderSetup)

    const nextVersion = await findNextVersion(
      hostAgent,
      agentInstance,
      dir,
      packageJson,
      npmCommander,
      npmCommanderSetup,
    )

    expect(nextVersion).to.equal('3.10.1968')
  })
})

async function createPimport(envName, pathToCompose, dir) {
  const npmRegistryAddress = await getAddressForService(
    envName,
    pathToCompose,
    'npm-registry',
    4873,
  )
  const npmToken = await p(getNpmToken)(
    `http://${npmRegistryAddress}/`,
    'npm-user',
    'gil@tayar.org',
    'npm-user-password',
  )
  const pimport = await pluginImport(
    [
      {
        'host-agent': hostAgentService,
        'npm-commander': {
          package: npmCommanderService,
          npmAuthenticationLine: `//${npmRegistryAddress}/:_authToken="${npmToken}"`,
        },
      },
    ],
    {appConfigs: [{directory: dir}]},
  )
  return pimport
}

async function createPackage() {
  const tmpDir = await p(fs.mkdtemp)(os.tmpdir() + '/')

  await p(fs.copyFile)(
    path.join(__dirname, 'this-package-not-in-npm-reg-a', 'package.json'),
    path.join(tmpDir, 'package.json'),
  )

  return tmpDir
}

async function publishPackage(dir, agent, agentInstance, npmCommander, npmCommanderSetup) {
  await agent.executeCommand(
    npmCommander.transformAgentCommand(
      {
        agentInstance,
        command: ['npm', 'publish'],
        directory: dir,
      },
      {setup: npmCommanderSetup},
    ),
  )
}
