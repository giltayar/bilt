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
  const pathToCompose = path.join(__dirname, 'docker-compose.yml')
  const envName = dockerComposeTool(before, after, pathToCompose, {
    shouldPullImages: (process.env.NODE_ENV || 'development') !== 'development',
    brutallyKill: true,
  })

  let dir
  let hostAgent
  let agentInstance
  let packageJson
  let npmCommander
  let npmCommanderSetup
  before(async () => {
    dir = await createPackage()
    const pimport = await createPimport(envName, pathToCompose, dir)

    hostAgent = await pimport('host-agent')
    agentInstance = await hostAgent.acquireInstanceForJob()

    npmCommander = await pimport('npm-commander')
    npmCommanderSetup = await npmCommander.setup({agentInstance})

    packageJson = JSON.parse(await p(fs.readFile)(path.join(dir, 'package.json')))
  })

  it('should find the next version of an existing package', async () => {
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

  it('should return undefined if no package', async () => {
    const packageJson = {name: 'this-package-does-not-exist-hahahaha', version: '4.5.9'}

    const nextVersion = await findNextVersion(
      hostAgent,
      agentInstance,
      dir,
      packageJson,
      npmCommander,
      npmCommanderSetup,
    )

    expect(nextVersion).to.equal('4.5.9')
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
          npmRegistry: `http://${npmRegistryAddress}`,
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
        cwd: dir,
      },
      {setup: npmCommanderSetup},
    ),
  )
}
