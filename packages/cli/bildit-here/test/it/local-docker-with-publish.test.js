'use strict'
const path = require('path')
const {describe, it, before, after} = require('mocha')
const {dockerComposeTool, getAddressForService} = require('docker-compose-mocha')
const {
  setupBuildDir,
  setupFolder,
  adjustNpmRegistryInfoInRepo,
  checkVersionExists,
} = require('../utils/setup')
const bilditHere = require('../../src/bildit-here')

const testRepoSrc = path.resolve(__dirname, 'bildit-here/test-repo-local-docker')

describe('local directory (with docker) with publish use-case', () => {
  const pathToCompose = path.join(__dirname, 'docker-compose.yml')

  let gitServerRepoDir
  before(async () => {
    gitServerRepoDir = await setupFolder(path.join(__dirname, 'bildit-here/git-server/repos/'))
  })

  const envName = dockerComposeTool(before, after, pathToCompose, {
    envVars: {
      NPM_USER: 'npm-user',
      NPM_PASSWORD: 'npm-user-password',
      get GIT_DIR() {
        return gitServerRepoDir
      },
    },
    shouldPullImages: false,
  })

  it('should build the directory with all its packages', async () => {
    const npmRegistryAddress = await getAddressForService(
      envName,
      pathToCompose,
      'npm-registry',
      4873,
    )
    const gitServerAddress = await getAddressForService(envName, pathToCompose, 'git-server', 22)

    const npmRegistry = `http://${npmRegistryAddress}/`

    process.env = {
      ...process.env,
      npm_config_registry: npmRegistry,
      KEYS_DIR: path.resolve(__dirname, 'bildit-here/git-server/keys'),
      TEST_NETWORK: `${envName.replace('_', '')}_default`,
    }
    const remoteRepo = `ssh://git@${gitServerAddress}/git-server/repos/test-repo`
    const buildDir = await setupBuildDir(
      testRepoSrc,
      remoteRepo,
      remoteRepo.replace(gitServerAddress, 'git-server:22'),
    )
    await adjustNpmRegistryInfoInRepo(buildDir, npmRegistryAddress, 'npm-registry:4873')

    await bilditHere(buildDir)

    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.a', '1.0.1', npmRegistryAddress)
    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.b', '3.2.1', npmRegistryAddress)
  })
})
