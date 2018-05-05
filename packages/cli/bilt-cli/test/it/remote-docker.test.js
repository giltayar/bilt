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
const biltHere = require('../../src/bilt-cli')

const testRepoSrc = path.resolve(__dirname, 'bilt-cli/test-repo-remote')

describe.skip('remote docker with publish use-case', () => {
  const pathToCompose = path.join(__dirname, 'docker-compose.yml')

  let gitServerRepoDir
  before(async () => {
    gitServerRepoDir = await setupFolder(path.join(__dirname, 'bilt-cli/git-server/repos/'))
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

    process.env = {
      ...process.env,
      npm_config_registry: 'http://npm-registry:4873',
      KEYS_DIR: path.resolve(__dirname, 'bilt-cli/git-server/keys'),
      TEST_NETWORK: `${envName}_default`,
    }
    const remoteRepo = `ssh://git@${gitServerAddress}/git-server/repos/test-repo`
    const buildDir = await setupBuildDir(
      testRepoSrc,
      remoteRepo,
      undefined,
      async buildDir =>
        await adjustNpmRegistryInfoInRepo(buildDir, npmRegistryAddress, 'npm-registry:4873'),
    )

    await biltHere(buildDir, remoteRepo.replace(gitServerAddress, 'git-server:22'))

    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.a', '1.0.0', npmRegistryAddress)
    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.b', '3.2.0', npmRegistryAddress)
  })
})
