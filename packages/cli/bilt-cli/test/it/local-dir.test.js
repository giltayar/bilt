'use strict'
const {promisify: p} = require('util')
const path = require('path')
const fs = require('fs')
const {expect} = require('chai')
const {describe, it, before, after} = require('mocha')
const {dockerComposeTool, getAddressForService} = require('docker-compose-mocha')
const {fileContents} = require('../utils/file-utils')
const {
  setupBuildDir,
  setupFolder,
  adjustNpmRegistryInfoInRepo,
  checkVersionExists,
} = require('../utils/setup')
const biltHere = require('../../src/bilt-cli')

const testRepoSrc = path.resolve(__dirname, 'bilt-cli/test-repo-local')

describe.only('local directory use-case', () => {
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
    brutallyKill: true,
  })

  it('should build the directory with all its packages, and on rebuild do nothing', async () => {
    const npmRegistryAddress = await getAddressForService(
      envName,
      pathToCompose,
      'npm-registry',
      4873,
    )
    const gitServerAddress = await getAddressForService(envName, pathToCompose, 'git-server', 22)

    const remoteRepo = `ssh://git@${gitServerAddress}/git-server/repos/test-repo`

    process.env = {
      ...process.env,
      npm_config_registry: `http://${npmRegistryAddress}/`,
      KEYS_DIR: path.resolve(__dirname, 'bilt-cli/git-server/keys'),
    }

    const buildDir = await setupBuildDir(
      testRepoSrc,
      remoteRepo,
      undefined,
      async buildDir => await adjustNpmRegistryInfoInRepo(buildDir, npmRegistryAddress),
    )

    await biltHere(buildDir)

    expect(await fileContents(buildDir, 'a/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/built.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/tested.txt')).to.equal('')
    expect(await fileContents(buildDir, 'c/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'c/voodooed.txt')).to.equal('')
    expect(await fileContents(buildDir, 'a/c-voodooed.txt')).to.equal('')

    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.a', '1.0.0', npmRegistryAddress)
    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.b', '3.2.0', npmRegistryAddress)

    await p(fs.unlink)(path.join(buildDir, 'a/postinstalled.txt'))
    await p(fs.unlink)(path.join(buildDir, 'b/postinstalled.txt'))
    await p(fs.unlink)(path.join(buildDir, 'c/voodooed.txt'))

    await biltHere(buildDir)

    expect(await p(fs.exists)(path.join(buildDir, 'a/postinstalled.txt'))).to.be.false
    expect(await p(fs.exists)(path.join(buildDir, 'b/postinstalled.txt'))).to.be.false
    expect(await p(fs.exists)(path.join(buildDir, 'c/voodooed.txt'))).to.be.false

    await biltHere(buildDir, {force: true, from: [path.join(buildDir, 'b')]})

    expect(await p(fs.exists)(path.join(buildDir, 'a/postinstalled.txt'))).to.be.true
    expect(await p(fs.exists)(path.join(buildDir, 'b/postinstalled.txt'))).to.be.true
    expect(await p(fs.exists)(path.join(buildDir, 'c/voodooed.txt'))).to.be.false

    await p(fs.unlink)(path.join(buildDir, 'a/postinstalled.txt'))
    await p(fs.unlink)(path.join(buildDir, 'b/postinstalled.txt'))

    await biltHere(buildDir, {force: true, upto: ['this-pkg-does-not-exist-in-npmjs.b']})

    expect(await p(fs.exists)(path.join(buildDir, 'a/postinstalled.txt'))).to.be.false
    expect(await p(fs.exists)(path.join(buildDir, 'b/postinstalled.txt'))).to.be.true
    expect(await p(fs.exists)(path.join(buildDir, 'c/voodooed.txt'))).to.be.false
  })
})
