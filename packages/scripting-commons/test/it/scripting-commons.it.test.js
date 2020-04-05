'use strict'
const {describe, it} = require('mocha')
const expect = require('unexpected')

const {sh, shWithOutput, makeTemporaryDirectory} = require('../../src/scripting-commons')

describe('scripting-commons', function () {
  it('should output command output', async () => {
    const tmpDir = await makeTemporaryDirectory()

    await sh('touch bar', {cwd: tmpDir})
    await sh('touch foo', {cwd: tmpDir})
    const lsOutput = await shWithOutput('ls', {cwd: tmpDir})

    expect(lsOutput, 'to equal', 'bar\nfoo\n')
  })

  it('should fail on bad command', async () => {
    await expect(
      sh('this-executable-should-not-exist', {cwd: process.cwd()}),
      'to be rejected with error satisfying',
      {message: /command not found/, code: 127},
    )
    await expect(
      shWithOutput('this-executable-should-not-exist', {cwd: process.cwd()}),
      'to be rejected with error satisfying',
      {message: /command not found/, code: 127},
    )
  })

  it('should fail on command that returns bad exit code', async () => {
    await expect(
      sh('ls this-file-should-not-exist', {cwd: process.cwd()}),
      'to be rejected with error satisfying',
      {message: /Command failed/, code: 1},
    )
    await expect(
      shWithOutput('ls this-file-should-not-exist', {cwd: process.cwd()}),
      'to be rejected with error satisfying',
      {message: /No such file or directory/, code: 1},
    )
  })
})
