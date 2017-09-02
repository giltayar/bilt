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
    it.only('should build the directory with all its packages', async () => {
      const testRepo = copyToTemp(testRepoSrc)
      const {stdout, stderr} = p(exec)(`${process.argv0} ${cli} ${testRepo}`)

      expect(stdout).to.not.equal('')
      expect(stderr).to.equal('')
    })
  })
})

async function copyToTemp(dir) {
  const tmpDir = await p(fs.mkdtemp)(
    path.join(os.tmpdir(), (Math.random() * 100000).toString().slice(6)),
  )

  await p(cpr)(dir + '/', tmpDir, {overwrite: true})

  console.log(`copied ${dir} => ${tmpDir}`)

  return tmpDir
}
