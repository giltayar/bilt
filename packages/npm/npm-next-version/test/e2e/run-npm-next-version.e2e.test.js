'use strict'
const {promisify: p} = require('util')
const {execFile} = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')
const {describe, it} = require('mocha')
const {expect} = require('chai')

describe('run-npm-next-version (e2e)', function() {
  it('should work with --no-update-package-json', async () => {
    const tmpDir = await p(fs.mkdtemp)(os.tmpdir() + '/')

    await p(fs.writeFile)(
      path.join(tmpDir, 'package.json'),
      await p(fs.readFile)(
        path.join(__dirname, '../package-that-is-for-testing-npm-next-version/package.json'),
      ),
    )

    const {stdout} = await p(execFile)(
      path.join(__dirname, '../../scripts/run-npm-next-version.js'),
      ['--no-update-package-json'],
      {cwd: tmpDir},
    )

    expect(stdout.trim()).to.equal('1.4.7')

    expect(JSON.parse(await p(fs.readFile)(path.join(tmpDir, 'package.json')))).to.have.property(
      'version',
      '1.4.6',
    )
  })

  it('should work with --update-package-json', async () => {
    const tmpDir = await p(fs.mkdtemp)(os.tmpdir() + '/')

    await p(fs.writeFile)(
      path.join(tmpDir, 'package.json'),
      await p(fs.readFile)(
        path.join(__dirname, '../package-that-is-for-testing-npm-next-version/package.json'),
      ),
    )

    const {stdout} = await p(execFile)(
      path.join(__dirname, '../../scripts/run-npm-next-version.js'),
      {cwd: tmpDir},
    )

    expect(stdout.trim()).to.equal('1.4.7')

    expect(JSON.parse(await p(fs.readFile)(path.join(tmpDir, 'package.json')))).to.have.property(
      'version',
      '1.4.7',
    )
  })
})
