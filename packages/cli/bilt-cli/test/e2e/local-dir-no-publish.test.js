'use strict'

const path = require('path')
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {exec} = require('child_process')
const {promisify: p} = require('util')
const {fileContents, writeFile} = require('../utils/file-utils')
const {setupBuildDir} = require('../utils/setup')

const cli = path.resolve(__dirname, '../../scripts/run-bilt-cli.js')
const testRepoSrc = path.resolve(__dirname, 'test-repo-no-publish')

describe('local directory use-case', () => {
  describe('no publish use case', () => {
    describe('with git', () => {
      it('should build the directory with all its packages and then say there is nothing to rebuild', async () => {
        const testRepo = await setupBuildDir(testRepoSrc)

        await p(exec)(`${process.argv0} ${cli} ${testRepo}`)

        const {stdout, stderr} = await p(exec)(`${process.argv0} ${cli} ${testRepo}`, {
          env: {...process.env, DEBUG: ''},
        })
        console.log(stdout, stderr)

        expect(stdout).to.equal('')
        expect(stderr.trim()).to.equal('Nothing to build')
      })

      it('should rebuild only changed packages and then rebuild nothing', async () => {
        const testRepo = await setupBuildDir(testRepoSrc)

        await p(exec)(`${process.argv0} ${cli} ${testRepo}`)

        await writeFile('touched!', testRepo, 'b/b.txt')

        const {stdout} = await p(exec)(`${process.argv0} ${cli} ${testRepo}`)

        expect(stdout).to.include('Building b')
        expect(stdout).to.not.include('Building a')

        expect(await fileContents(testRepo, 'b/built.txt')).to.equal('touched!')

        const {stdout: stdout2, stderr: stderr2} = await p(
          exec,
        )(`${process.argv0} ${cli} ${testRepo}`, {
          env: {...process.env, DEBUG: ''},
        })
        expect(stdout2).to.equal('')
        expect(stderr2.trim()).to.equal('Nothing to build')
      })
    })
  })
})
