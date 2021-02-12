import mocha from 'mocha'
const {describe, it} = mocha
import {expect, use} from 'chai'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

import {
  sh,
  shWithOutput,
  makeTemporaryDirectory,
  writeFile,
  readFileAsString,
  readFileAsJson,
} from '../../src/scripting-commons.js'

describe('scripting-commons', function () {
  it('should output command output', async () => {
    const tmpDir = await makeTemporaryDirectory()

    await sh('touch bar', {cwd: tmpDir})
    await sh('touch foo', {cwd: tmpDir})
    const lsOutput = await shWithOutput('ls', {cwd: tmpDir})

    expect(lsOutput).to.equal('bar\nfoo\n')
  })

  it('should support env', async () => {
    const tmpDir = await makeTemporaryDirectory()

    await sh('echo bart > $BAR', {cwd: tmpDir, env: {BAR: 'bar'}})
    const lsOutput = await shWithOutput('cat $BAR', {cwd: tmpDir, env: {BAR: 'bar'}})

    expect(lsOutput).to.equal('bart\n')
  })

  it('should fail on bad command', async () => {
    await expect(
      sh('this-executable-should-not-exist', {cwd: process.cwd()}),
    ).to.eventually.be.rejectedWith(/not found/)
    await expect(
      shWithOutput('this-executable-should-not-exist', {cwd: process.cwd()}),
    ).to.eventually.be.rejectedWith(/not found/)
  })

  it('should fail on command that returns bad exit code', async () => {
    await expect(
      sh('ls this-file-should-not-exist', {cwd: process.cwd()}),
    ).to.eventually.be.rejectedWith(/Command failed/)
    await expect(
      shWithOutput('ls this-file-should-not-exist', {cwd: process.cwd()}),
    ).to.eventually.be.rejectedWith(/No such file or directory/)
  })

  it('should read/write files', async () => {
    const cwd = await makeTemporaryDirectory()

    await writeFile('foo.txt', 'hello', {cwd})
    await writeFile(['bar', 'bar.txt'], 'world', {cwd})
    await writeFile('foo.json', {hello: 'world'}, {cwd})

    expect(await readFileAsString('foo.txt', {cwd})).to.equal('hello')
    expect(await readFileAsString(['bar', 'bar.txt'], {cwd})).to.equal('world')
    expect(await readFileAsJson(['foo.json'], {cwd})).to.eql({hello: 'world'})
  })
})
