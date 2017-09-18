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

const testRepoSrc = path.resolve(__dirname, 'bildit-here/test-repo-local-docker')

describe('local directory use-case', () => {
  describe('with publish use case', () => {
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

      process.env = {
        npm_config_registry: `http://${npmRegistryAddress}/`,
        KEYS_DIR: path.resolve(__dirname, 'bildit-here/git-server/keys'),
        TEST_NETWORK: `${envName.replace('_', '')}_default`,
        ...process.env,
      }
      const remoteRepo = `ssh://git@${gitServerAddress}/git-server/repos/test-repo`
      const buildDir = await setupBuildDir(
        testRepoSrc,
        remoteRepo,
        remoteRepo.replace(gitServerAddress, 'git-server:22'),
      )
      await adjustNpmRegistryInfoInRepo(buildDir, npmRegistryAddress, 'npm-registry:4873')

      await bilditHere(buildDir)

      checkVersionExists('this-pkg-does-not-exist-in-npmjs.a', '1.0.1')
      checkVersionExists('this-pkg-does-not-exist-in-npmjs.b', '3.2.1')
    })
  })
})

async function adjustNpmRegistryInfoInRepo(
  buildDir,
  hostNpmRegistryAddress,
  networkNpmRegistryAddress,
) {
  const npmToken = await p(getNpmToken)(
    `http://${hostNpmRegistryAddress}/`,
    'npm-user',
    'gil@tayar.org',
    'npm-user-password',
  )
  const bilditRc = await fileContents(buildDir, '.bilditrc.js')

  const modifiedBilditRc = bilditRc
    .replace(/localhost\:4873/g, networkNpmRegistryAddress)
    .replace('NPM_TOKEN', npmToken)

  await writeFile(modifiedBilditRc, buildDir, '.bilditrc.js')
}

async function checkVersionExists(pkg, version) {
  const {stdout} = await p(execFile)('npm', ['view', `${pkg}@${version}`])

  expect(stdout).to.include(version)
}
