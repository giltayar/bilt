'use strict'

const path = require('path')
const {describe, it, before, after} = require('mocha')
const {expect} = require('chai')
const {exec} = require('child_process')
const {promisify: p} = require('util')
const {dockerComposeTool, getAddressForService} = require('docker-compose-mocha')
const {fileContents, writeFile} = require('../utils/file-utils')
const {setupFolder, setupGitRepo} = require('../utils/setup')

const cli = path.resolve(__dirname, '../../src/bildit-here.js')
const testRepoSrc = path.resolve(__dirname, 'test-repo')

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
      const testRepo = await setupFolder(path.join(testRepoSrc, 'commit-1'))
      await adjustNpmRegistryLocationInRepo(testRepo, npmRegistryAddress)

      try {
        const {stdout, stderr} = await p(exec)(`${process.argv0} ${cli} ${testRepo}`, {
          env: {
            npm_config_registry: `http://${npmRegistryAddress}/`,
            KEYS_DIR: path.resolve(__dirname, 'git-server/keys'),
            DEBUG: 'bildit:npm-publisher-with-git,bildit:git-vcs',
            ...process.env,
          },
        })

        expect(stdout).to.include('Building a')
        expect(stdout).to.include('Building b')
        expect(await fileContents(testRepo, 'a/postinstalled.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/postinstalled.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/built.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/tested.`txt')).to.equal('')
      } catch (e) {
        console.error('error running cli', e)
      }
    })
  })
})
async function adjustNpmRegistryLocationInRepo(testRepo, npmRegistryAddress) {
  const bilditRc = await fileContents(testRepo, '.bilditrc.js')

  bilditRc.replace('localhost:4873', npmRegistryAddress)

  await writeFile(bilditRc, testRepo, '.bilditrc.js')
}
