'use strict'
const {describe, it} = require('mocha')
const expect = require('unexpected')
const {makeTemporaryDirectory, writeFile, sh} = require('@bilt/scripting-commons')

const {init, commitAll, commitHistory} = require('../../src/git-testkit')

describe('git-testkit (it)', function () {
  it('should be able to do all the nice operations', async () => {
    const cwdSource = await makeTemporaryDirectory()
    const cwdTarget = await makeTemporaryDirectory()
    await init(cwdTarget, {bare: true})
    await init(cwdSource, {origin: cwdTarget})

    await writeFile('foo.txt', 'foo', {cwd: cwdSource})
    await writeFile('bar.txt', 'bar', {cwd: cwdSource})

    await commitAll(cwdSource, 'a commit')

    const history = await commitHistory(cwdSource)
    expect(Object.keys(history), 'to have length', 2)

    expect(history, 'to have a value satisfying', ['bar.txt', 'foo.txt'])

    await sh(`git push`, {cwd: cwdSource})

    const targetHistory = await commitHistory(cwdTarget)
    expect(Object.keys(targetHistory), 'to have length', 2)

    expect(targetHistory, 'to have a value satisfying', ['bar.txt', 'foo.txt'])
  })
})
