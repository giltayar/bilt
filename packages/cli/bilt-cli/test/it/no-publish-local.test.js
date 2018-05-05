'use strict'
const {promisify: p} = require('util')
const path = require('path')
const fs = require('fs')
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {fileContents} = require('../utils/file-utils')
const {setupBuildDir} = require('../utils/setup')
const biltHere = require('../../src/bilt-cli')

const testRepoSrc = path.resolve(__dirname, 'bilt-cli/test-repo-local')

describe.skip('local directory, no publish use-case', () => {
  it('should build the directory with all its packages, and on rebuild do nothing', async () => {
    const biltOptions = {disabledSteps: ['publish', 'increment-version']}
    const buildDir = await setupBuildDir(testRepoSrc)

    await biltHere(buildDir, biltOptions)

    expect(await fileContents(buildDir, 'a/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/built.txt')).to.equal('')
    expect(await fileContents(buildDir, 'b/tested.txt')).to.equal('')
    expect(await fileContents(buildDir, 'c/postinstalled.txt')).to.equal('')
    expect(await fileContents(buildDir, 'c/voodooed.txt')).to.equal('')
    expect(await fileContents(buildDir, 'a/c-voodooed.txt')).to.equal('')

    await p(fs.unlink)(path.join(buildDir, 'a/postinstalled.txt'))
    await p(fs.unlink)(path.join(buildDir, 'b/postinstalled.txt'))
    await p(fs.unlink)(path.join(buildDir, 'c/voodooed.txt'))

    await biltHere(buildDir, biltOptions)

    expect(await p(fs.exists)(path.join(buildDir, 'a/postinstalled.txt'))).to.be.false
    expect(await p(fs.exists)(path.join(buildDir, 'b/postinstalled.txt'))).to.be.false
    expect(await p(fs.exists)(path.join(buildDir, 'c/voodooed.txt'))).to.be.false

    await biltHere(buildDir, {...biltOptions, force: true, from: [path.join(buildDir, 'b')]})

    expect(await p(fs.exists)(path.join(buildDir, 'a/postinstalled.txt'))).to.be.true
    expect(await p(fs.exists)(path.join(buildDir, 'b/postinstalled.txt'))).to.be.true
    expect(await p(fs.exists)(path.join(buildDir, 'c/voodooed.txt'))).to.be.false

    await p(fs.unlink)(path.join(buildDir, 'a/postinstalled.txt'))
    await p(fs.unlink)(path.join(buildDir, 'b/postinstalled.txt'))

    await biltHere(buildDir, {
      ...biltOptions,
      force: true,
      upto: ['this-pkg-does-not-exist-in-npmjs.b'],
    })

    expect(await p(fs.exists)(path.join(buildDir, 'a/postinstalled.txt'))).to.be.false
    expect(await p(fs.exists)(path.join(buildDir, 'b/postinstalled.txt'))).to.be.true
    expect(await p(fs.exists)(path.join(buildDir, 'c/voodooed.txt'))).to.be.false
  })
})
