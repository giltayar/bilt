'use strict'

const path = require('path')
const fs = require('fs')
const os = require('os')
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {exec} = require('child_process')
const {promisify: p} = require('util')
const cpr = require('cpr')

const cli = path.resolve(__dirname, '../../src/bildit-here.js')
const testRepoSrc = path.resolve(__dirname, 'test-repo')

describe('local directory use-case', () => {
  describe('no publish use case', () => {
    describe('without git', () => {
      it.only('should build the directory with all its packages', async () => {
        const testRepo = await copyToTemp(testRepoSrc)
        const {stdout} = await p(exec)(`${process.argv0} ${cli} ${testRepo}`)

        expect(stdout).to.include('Building a')
        expect(stdout).to.include('Building b')
        expect(await fileContents(testRepo, 'a/postinstalled.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/postinstalled.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/built.txt')).to.equal('')
        expect(await fileContents(testRepo, 'b/tested.txt')).to.equal('')
      })
    })
  })
})

async function fileContents(...paths) {
  return await p(fs.readFile)(path.join(...paths), 'utf-8')
}

async function copyToTemp(dir) {
  const tmpDir = await p(fs.mkdtemp)(
    path.join(os.tmpdir(), (Math.random() * 100000).toString().slice(6)),
  )

  await p(cpr)(dir + '/', tmpDir, {overwrite: true})

  return tmpDir
}
