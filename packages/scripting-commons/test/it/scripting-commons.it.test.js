'use strict'
const {describe, it} = require('mocha')
const expect = require('unexpected')

const {
  sh,
  shWithOutput,
  makeTemporaryDirectory,
  writeFile,
  readFileAsString,
  readFileAsJson,
} = require('../../src/scripting-commons')

describe('scripting-commons', function () {
  it('should output command output', async () => {
    const tmpDir = await makeTemporaryDirectory()

    await sh('touch bar', {cwd: tmpDir})
    await sh('touch foo', {cwd: tmpDir})
    const lsOutput = await shWithOutput('ls', {cwd: tmpDir})

    expect(lsOutput, 'to equal', 'bar\nfoo\n')
  })

  it('should support env', async () => {
    const tmpDir = await makeTemporaryDirectory()

    await sh('echo bart > $BAR', {cwd: tmpDir, env: {BAR: 'bar'}})
    const lsOutput = await shWithOutput('cat $BAR', {cwd: tmpDir, env: {BAR: 'bar'}})

    expect(lsOutput, 'to equal', 'bart\n')
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

  it('should read/write files', async () => {
    const cwd = await makeTemporaryDirectory()

    await writeFile('foo.txt', 'hello', {cwd})
    await writeFile(['bar', 'bar.txt'], 'world', {cwd})
    await writeFile('foo.json', {hello: 'world'}, {cwd})

    expect(await readFileAsString('foo.txt', {cwd}), 'to equal', 'hello')
    expect(await readFileAsString(['bar', 'bar.txt'], {cwd}), 'to equal', 'world')
    expect(await readFileAsJson(['foo.json'], {cwd}), 'to equal', {hello: 'world'})
  })
})
