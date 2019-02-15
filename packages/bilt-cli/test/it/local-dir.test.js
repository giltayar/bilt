'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const path = require('path')
const {exec} = require('child_process')
const {expect} = require('chai')
const {describe, it, afterEach, beforeEach} = require('mocha')
const {dockerComposeTool, getAddressForService} = require('docker-compose-mocha')
const {fileContents, writeFile} = require('../utils/file-utils')
const {
  setupBuildDir,
  setupFolder,
  adjustNpmRegistryInfoInRepo,
  checkVersionExists,
} = require('../utils/setup')
const biltHere = require('../../src/bilt-cli')

const testRepoSrc = path.resolve(__dirname, 'bilt-cli/test-repo-local')

describe('local directory use-case', () => {
  const pathToCompose = path.join(__dirname, 'docker-compose.yml')

  let gitServerRepoDir
  beforeEach(async () => {
    gitServerRepoDir = await setupFolder(path.join(__dirname, 'bilt-cli/git-server/repos/'))
  })

  const envName = dockerComposeTool(beforeEach, afterEach, pathToCompose, {
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

  let buildDir
  let npmRegistryAddress
  beforeEach(async () => {
    npmRegistryAddress = await getAddressForService(envName, pathToCompose, 'npm-registry', 4873)
    const gitServerAddress = await getAddressForService(envName, pathToCompose, 'git-server', 22)

    const remoteRepo = `ssh://git@${gitServerAddress}/git-server/repos/test-repo`

    buildDir = await setupBuildDir(
      testRepoSrc,
      remoteRepo,
      undefined,
      path.resolve(__dirname, 'bilt-cli/git-server/keys'),
      async buildDir => await adjustNpmRegistryInfoInRepo(buildDir, npmRegistryAddress),
    )
  })

  it('should build the directory with all its packages, including publishing, reset, and then rebuild nothing', async () => {
    const retCode = await biltHere(buildDir, {disabledSteps: ['link']})
    expect(retCode).to.equal(0)

    expect(await fileContents(buildDir, 'a/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/postinstalled.txt')).to.equal('lalala')
    expect(await fileContents(buildDir, 'b/built.txt')).to.equal('lalala')
    expect(await fileContents(buildDir, 'b/tested.txt')).to.equal('lalala')
    expect(await fileContents(buildDir, 'c/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'c/voodooed.txt')).to.equal('')
    expect(await fileContents(buildDir, 'a/c-voodooed.txt')).to.equal('')

    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.a', '1.0.0', npmRegistryAddress)
    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.b', '3.2.0', npmRegistryAddress)

    // This simulates rerunning the same build in the CI
    await gitReset(buildDir)

    await biltHere(buildDir, {disabledSteps: ['link']})

    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.a', '1.0.0', npmRegistryAddress)
    await checkVersionExists('this-pkg-does-not-exist-in-npmjs.b', '3.2.0', npmRegistryAddress)
  })

  it('should support link', async () => {
    await biltHere(buildDir)

    await changeScript(
      buildDir,
      'a',
      'build',
      'cp node_modules/this-pkg-does-not-exist-in-npmjs.b/b.txt .',
    )
    await writeFile('something new', buildDir, 'b/b.txt')

    await biltHere(buildDir, {
      disabledSteps: ['increment-version', 'publish'],
      enabledSteps: ['link', 'reset-links'],
    })

    expect(await fileContents(buildDir, 'a/b.txt')).to.equal('something new')
  })

  it('should support dry-run', async () => {
    const retCode = await biltHere(buildDir, {dryRun: true})

    expect(retCode).to.equal(0)
    expect(await fileContents(buildDir, 'a/postinstalled.txt')).to.be.undefined
  })

  it('should return 1 on failure', async () => {
    await changeScript(buildDir, 'a', 'build', 'false')

    const retCode = await biltHere(buildDir)

    expect(retCode).to.equal(1)
  })
})

async function changeScript(buildDir, packageFolder, scriptName, script) {
  const packageJson = JSON.parse(
    await p(fs.readFile)(path.join(buildDir, packageFolder, 'package.json'), 'utf-8'),
  )

  packageJson.scripts[scriptName] = script

  await p(fs.writeFile)(
    path.join(buildDir, packageFolder, 'package.json'),
    JSON.stringify(packageJson),
  )
}

async function gitReset(directory) {
  await p(exec)('git reset  --hard HEAD', {cwd: directory})
}
