'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {writeFile} = require('@bilt/scripting-commons')
const {prepareForSimpleBuild, runBuild, packageScriptCount} = require('../commons/setup-and-run')

describe('build-options (it)', function () {
  it('should use and allow overriding the values in .biltrc', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml', {jobs: {build: {during1: false}}})

    await writeFile(['a', 'package.json'], {name: 'a-package', version: '1.0.0'}, {cwd})

    await runBuild(cwd, 'a build with biltrc defaults', ['./a'], undefined)

    expect(await packageScriptCount(cwd, 'a', 'during1')).to.equal(0)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)

    await runBuild(cwd, 'a build with biltrc defaults and an override', ['./a'], undefined, [
      '--during1',
      '--force',
    ])
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(2)
  })
})
