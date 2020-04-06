'use strict'
const path = require('path')
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {init, commitAll, commitHistory} = require('@bilt/git-testkit')
const {startNpmRegistry} = require('@bilt/npm-testkit')
const {makeTemporaryDirectory, writeFile, shWithOutput} = require('@bilt/scripting-commons')

const applitoolsBuild = require('../../src/bilt-applitools-cli')

describe('applitools build', function () {
  it('should build two packages, first time, no dependencies', async () => {
    const cwd = await makeTemporaryDirectory()
    const pushTarget = await makeTemporaryDirectory()
    await init(pushTarget, {bare: true})
    await init(cwd, {origin: pushTarget})
    const {registry} = await startNpmRegistry()

    await writeFile(['.npmrc'], `registry=${registry}`, {cwd})
    await writeFile(['.biltrc.json'], {}, {cwd})
    await writeFile(['a', 'package.json'], {name: 'a-package', version: '1.0.0'}, {cwd})
    await writeFile(['a', '.npmrc'], `registry=${registry}`, {cwd})
    await writeFile(['b', 'package.json'], {name: 'b-package', version: '2.0.0'}, {cwd})
    await writeFile(['b', '.npmrc'], `registry=${registry}`, {cwd})
    await writeFile(['not-a-package', 'foo.txt'], 'foo', {cwd})

    await commitAll(cwd, 'first commit')

    await applitoolsBuild([
      'a',
      'b',
      '--config',
      path.join(cwd, '.biltrc.json'),
      '-m',
      'first build',
    ])

    const history = await commitHistory(cwd)

    expect(Object.entries(history)[0][1]).to.have.members([
      'a/package.json',
      'a/package-lock.json',
      'b/package.json',
      'b/package-lock.json',
    ])

    const {promisify: p} = require('util')
    await p(setTimeout)(1000000000)

    expect(await shWithOutput('npm view a-package version', {cwd})).to.eql('1.0.0\n')
    expect(await shWithOutput('npm view a-package version', {cwd})).to.eql('2.0.0\n')
  })
})
