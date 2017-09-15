'use strict'

const path = require('path')
const fs = require('fs')
const os = require('os')
const {describe, it, before, after} = require('mocha')
const {expect} = require('chai')
const {promisify: p} = require('util')
const {dockerComposeTool, getAddressForService} = require('docker-compose-mocha')
const {fileContents, writeFile} = require('../utils/file-utils')
const {setupGitRepo} = require('../utils/setup')
const bilditHere = require('../../src/bildit-here')

const testRepoSrc = path.resolve(__dirname, 'bildit-here/test-repo')

describe('local directory use-case', () => {
  describe('with publish use case', () => {
    const pathToCompose = path.join(__dirname, 'docker-compose.yml')

    let testRepo
    before(async () => {
      testRepo = await p(fs.mkdtemp)(
        path.join(__dirname, 'bildit-here/git-server/replay-git-repo/'),
      )
    })

    const envName = dockerComposeTool(before, after, pathToCompose, {
      envVars: {
        NPM_USER: 'npm-user',
        NPM_PASSWORD: 'npm-user-password',
        get GIT_DIR() {
          return testRepo
        },
      },
      shouldPullImages: false,
    })

    before(async () => {
      const gitServerAddress = await getAddressForService(envName, pathToCompose, 'git-server', 22)

      await setupGitRepo(
        testRepoSrc,
        `ssh://git@${gitServerAddress}/git-server/repos/test-repo`,
        testRepo,
      )
    })

    it.only('should build the directory with all its packages', async () => {
      const npmRegistryAddress = await getAddressForService(
        envName,
        pathToCompose,
        'npm-registry',
        4873,
      )
      await adjustNpmRegistryLocationInRepo(testRepo, npmRegistryAddress)

      process.env = {
        npm_config_registry: `http://${npmRegistryAddress}/`,
        KEYS_DIR: path.resolve(__dirname, 'bildit-here/git-server/keys'),
        ...process.env,
      }
      await bilditHere(testRepo)

      expect(await fileContents(testRepo, 'a/postinstalled.txt')).to.equal('')
      expect(await fileContents(testRepo, 'b/postinstalled.txt')).to.equal('')
      expect(await fileContents(testRepo, 'b/built.txt')).to.equal('')
      expect(await fileContents(testRepo, 'b/tested.`txt')).to.equal('')
    })
  })
})
async function adjustNpmRegistryLocationInRepo(testRepo, npmRegistryAddress) {
  const bilditRc = await fileContents(testRepo, '.bilditrc.js')

  const modifiedBilditRc = bilditRc.replace('localhost:4873', npmRegistryAddress)

  await writeFile(modifiedBilditRc, testRepo, '.bilditrc.js')
}
