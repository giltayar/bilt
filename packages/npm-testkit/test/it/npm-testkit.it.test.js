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

  it('should enable running an npm registry', async () => {
    const cwd = await makeTemporaryDirectory()
    await writeFile('package.json', {name: 'foo-package', version: '6.6.6'}, {cwd})

    const npmShOptions = {cwd, env: {...process.env, npm_config_registry: registry}}

    await sh('npm publish', npmShOptions)

    expect(await shWithOutput('npm view foo-package version', npmShOptions), 'to equal', '6.6.6\n')
  })
})
