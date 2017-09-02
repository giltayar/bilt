'use strict'

const path = require('path')
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {exec} = require('child_process')
const {promisify: p} = require('util')
const {fileContents} = require('../utils/file-utils')
const {setupFolder, setupGitRepo} = require('../utils/setup')

const cli = path.resolve(__dirname, '../../src/bildit-here.js')
const testRepoSrc = path.resolve(__dirname, 'test-repo')

describe('local directory use-case', () => {
  describe('no publish use case', () => {
    describe('without git', () => {
      it('should build the directory with all its packages', async () => {
        const testRepo = await setupFolder(path.join(testRepoSrc, 'commit-1'))
        const {stdout} = await p(exec)(`${process.argv0} ${cli} ${testRepo}`)

        expect(stdout).to.include('Building a')
        expect(stdout).to.include('Building b')
        expect(await fileContents(testRepo, 'a/postinstalled.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/postinstalled.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/built.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/tested.txt')).to.equal('')
      })
    })
    describe('with git', () => {
      it('should build the directory with all its packages and then say there is nothing to rebuild', async () => {
        const testRepo = await setupGitRepo(testRepoSrc)
        const {stdout} = await p(exec)(`${process.argv0} ${cli} ${testRepo}`)

        expect(stdout).to.include('Building a')
        expect(await fileContents(testRepo, 'a/postinstalled.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/postinstalled.txt')).to.equal('')

        const {stdout: stdout2, stderr: stderr2} = await p(exec)(
          `${process.argv0} ${cli} ${testRepo}`,
        )

        expect(stdout2).to.equal('')
        expect(stderr2.trim()).to.equal('Nothing to build')
      })
    })
  })
})
