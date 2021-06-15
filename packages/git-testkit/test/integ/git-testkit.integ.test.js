'use strict'
import {makeTemporaryDirectory, sh, writeFile} from '@bilt/scripting-commons'
import {expect} from 'chai'
import mocha from 'mocha'
import {commitAll, commitHistory, commitMessagesHistory, init} from '../../src/git-testkit.js'
const {describe, it} = mocha

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
    const messagesHistory = await commitMessagesHistory(cwdSource)
    expect(messagesHistory).to.eql(['message', 'first commit'])
    expect(Object.values(history)).to.have.length(2).and.deep.include(['bar.txt', 'foo.txt'])

    await sh(`git push`, {cwd: cwdSource})

    const targetHistory = await commitHistory(cwdTarget)

    expect(Object.values(targetHistory)).to.have.length(2).and.deep.include(['bar.txt', 'foo.txt'])
  })
})
