'use strict'
const {describe, it, before, after} = require('mocha')
const expect = require('unexpected')
const {sh, shWithOutput, makeTemporaryDirectory, writeFile} = require('@bilt/scripting-commons')

const {startNpmRegistry} = require('../../src/npm-testkit')

describe('startNpmRegistry', function () {
  /**@type {string}*/
  let registry
  /**@type {() => Promise<void>}*/
  let close
  before(async () => ({registry, close} = await startNpmRegistry()))
  after(() => close())

  it('should enable running an npm registry and publishing to it', async () => {
    const cwd = await makeTemporaryDirectory()
    await writeFile('package.json', {name: 'foo-package', version: '6.6.6'}, {cwd})
    await writeFile('.npmrc', `registry=${registry}`, {cwd})

    await sh('npm publish', {cwd})

    expect(await shWithOutput('npm view foo-package version', {cwd}), 'to equal', '6.6.6\n')
  })

  it('should support npm audit', async () => {
    const cwd = await makeTemporaryDirectory()
    await writeFile('package.json', {name: 'foo-package', version: '6.6.6'}, {cwd})
    await writeFile('.npmrc', `registry=${registry}`, {cwd})
    await sh('npm install', {cwd})

    await sh('npm audit', {cwd})

    expect(await shWithOutput('npm view foo-package version', {cwd}), 'to equal', '6.6.6\n')
  })
})
