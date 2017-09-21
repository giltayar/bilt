'use strict'
const path = require('path')
const {execFile} = require('child_process')
const {expect} = require('chai')
const {promisify: p} = require('util')
const {describe, it, before, after} = require('mocha')
const getNpmToken = require('get-npm-token')
const {dockerComposeTool, getAddressForService} = require('docker-compose-mocha')
const {fileContents, writeFile} = require('../utils/file-utils')
const {setupBuildDir, setupFolder} = require('../utils/setup')
const bilditHere = require('../../src/bildit-here')

const testRepoSrc = path.resolve(__dirname, 'bildit-here/test-repo-local')

describe.only('local directory with publish use-case', () => {
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

    const remoteRepo = `ssh://git@${gitServerAddress}/git-server/repos/test-repo`

    process.env = {
      ...process.env,
      npm_config_registry: `http://${npmRegistryAddress}/`,
      KEYS_DIR: path.resolve(__dirname, 'bildit-here/git-server/keys'),
    }

    const buildDir = await setupBuildDir(testRepoSrc, remoteRepo)
    await adjustNpmRegistryInfoInRepo(buildDir, npmRegistryAddress)
    await bilditHere(buildDir)

    expect(await fileContents(buildDir, 'a/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/built.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/tested.txt')).to.equal('')

    checkVersionExists('this-pkg-does-not-exist-in-npmjs.a', '1.0.1')
    checkVersionExists('this-pkg-does-not-exist-in-npmjs.b', '3.2.1')
  })
})

async function adjustNpmRegistryInfoInRepo(buildDir, npmRegistryAddress) {
  const npmToken = await p(getNpmToken)(
    `http://${npmRegistryAddress}/`,
    'npm-user',
    'gil@tayar.org',
    'npm-user-password',
  )
  const bilditRc = await fileContents(buildDir, 'bildit.config.js')

  const modifiedBilditRc = bilditRc
    .replace(/localhost\:4873/g, npmRegistryAddress)
    .replace('NPM_TOKEN', npmToken)

  await writeFile(modifiedBilditRc, buildDir, 'bildit.config.js')
}

async function checkVersionExists(pkg, version) {
  const {stdout} = await p(execFile)('npm', ['view', `${pkg}@${version}`])

  expect(stdout).to.include(version)
}
