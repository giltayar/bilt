'use strict'
const {describe, it, before, after} = require('mocha')
const {expect} = require('chai')
const setup = require('./setup')

const findNextVersion = require('../../src/find-next-version')

describe('findNextVersion', function() {
  const {agent, agentInstance, npmCommander, npmCommanderSetup, setupPackage} = setup(before, after)

  it('should find the next version of an existing package', async () => {
    const {dir, packageJson} = await setupPackage('this-package-not-in-npm-reg-a', {
      shouldPublish: true,
    })
    const nextVersion = await findNextVersion(
      agent(),
      agentInstance(),
      dir,
      packageJson,
      npmCommander(),
      npmCommanderSetup(),
    )

    expect(nextVersion).to.equal('3.10.1968')
  })

  it('should return undefined if no package', async () => {
    const {dir} = await setupPackage('this-package-not-in-npm-reg-b', {
      shouldPublish: false,
    })
    const packageJson = {name: 'this-package-does-not-exist-hahahaha', version: '4.5.9'}

    const nextVersion = await findNextVersion(
      agent(),
      agentInstance(),
      dir,
      packageJson,
      npmCommander(),
      npmCommanderSetup(),
    )

    expect(nextVersion).to.equal('4.5.9')
  })
})
