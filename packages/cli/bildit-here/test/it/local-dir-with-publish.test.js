'use strict'

const path = require('path')
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

    const envName = dockerComposeTool(before, after, pathToCompose, {
      envVars: {
        NPM_USER: 'npm-user',
        NPM_PASSWORD: 'npm-user-password',
      },
      shouldPullImages: false,
    })

    it.only('should build the directory with all its packages', async () => {
      const npmRegistryAddress = await getAddressForService(
        envName,
        pathToCompose,
        'npm-registry',
        4873,
      )
      const gitServerAddress = await getAddressForService(envName, pathToCompose, 'git-server', 22)
      const testRepo = await setupGitRepo(
        path.join(testRepoSrc),
        `ssh://git@${gitServerAddress}/test-repo`,
      )
      await adjustNpmRegistryLocationInRepo(testRepo, npmRegistryAddress)

      process.env = {
        npm_config_registry: `http://${npmRegistryAddress}/`,
        KEYS_DIR: path.resolve(__dirname, 'bildit-here/git-server/keys'),
        DEBUG: 'bildit:npm-publisher-with-git,bildit:git-vcs',
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

  bilditRc.replace('localhost:4873', npmRegistryAddress)

  await writeFile(bilditRc, testRepo, '.bilditrc.js')
}
